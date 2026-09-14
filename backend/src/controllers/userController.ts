import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { query } from '../config/database';
import { createError } from '../utils/errors';
import sharp from 'sharp';
import { uploadAvatarBuffer, isStorageAvailable } from '../services/storageService';
import { savePushSubscription } from '../services/pushService';

// Локализованные сообщения об ошибках
const getLocalizedErrorMessage = (errorKey: string, language?: string): string => {
  const lang = language || 'ru';

  const errorMessages: Record<string, Record<string, string>> = {
    phoneExists: {
      ru: 'Пользователь с таким номером телефона уже существует',
      en: 'User with this phone number already exists',
      ky: 'Мындай телефон номери менен колдонуучу бар'
    },
    telegramExists: {
      ru: 'Пользователь с таким никнеймом Telegram уже существует',
      en: 'User with this Telegram username already exists',
      ky: 'Мындай Telegram аты менен колдонуучу бар'
    }
  };

  return errorMessages[errorKey]?.[lang] || errorMessages[errorKey]?.ru || errorKey;
};

export const getMe = async (req: AuthRequest, res: Response, next: any) => {
  try {
    if (!req.user) {
      throw createError(401, 'UNAUTHORIZED', 'Authentication required');
    }

    const result = await query(
      `SELECT id, first_name, last_name, phone, phone_country, telegram_username, avatar_url, status, language, is_active, created_at, updated_at, last_login FROM users WHERE id = $1`,
      [req.user.userId],
    );

    if (result.rows.length === 0) {
      throw createError(404, 'NOT_FOUND', 'User not found');
    }

    const user = result.rows[0];

    // 1 year expiration (365 * 24 * 60 * 60 * 1000)
    const EXPIRATION_MS = 365 * 24 * 60 * 60 * 1000;
    const isExpired = (Date.now() - new Date(user.created_at).getTime()) > EXPIRATION_MS;
    const isBlocked = user.is_active === false;

    res.json({
      id: user.id,
      firstName: user.first_name,
      lastName: user.last_name,
      phone: user.phone,
      phoneCountry: user.phone_country,
      telegram: user.telegram_username,
      avatarUrl: user.avatar_url || null,
      status: user.status,
      language: user.language,
      createdAt: user.created_at,
      updatedAt: user.updated_at,
      isExpired: isExpired,
      isBlocked: isBlocked,
    });
  } catch (error) {
    next(error);
  }
};

export const updateMe = async (req: AuthRequest, res: Response) => {
  if (!req.user) {
    throw createError(401, 'UNAUTHORIZED', 'Authentication required');
  }

  try {
    const {
      firstName,
      lastName,
      phone,
      phoneCountry,
      telegram,
      avatar,
      status,
      language,
    } = req.body;

    // Get current user
    const currentUserResult = await query(
      `SELECT id, first_name, last_name, phone, phone_country, telegram_username, avatar_url, status, language FROM users WHERE id = $1`,
      [req.user.userId],
    );

    if (currentUserResult.rows.length === 0) {
      throw createError(404, 'NOT_FOUND', 'User not found');
    }

    const currentUser = currentUserResult.rows[0];

    // Check phone uniqueness if changed
    if (phone && phone !== currentUser.phone) {
      const phoneCheck = await query(
        `SELECT id FROM users WHERE phone = $1 AND phone_country = $2 AND id != $3`,
        [phone, phoneCountry || currentUser.phone_country, req.user.userId]
      );

      if (phoneCheck.rows.length > 0) {
        const acceptLanguage = req.headers['accept-language'];
        const userLanguage = acceptLanguage?.split(',')[0] || currentUser.language || 'ru';
        throw createError(400, 'VALIDATION_ERROR', getLocalizedErrorMessage('phoneExists', userLanguage));
      }
    }

    // Check Telegram uniqueness if changed
    if (telegram && telegram !== currentUser.telegram_username) {
      const telegramCheck = await query(
        `SELECT id FROM users WHERE (LOWER(telegram_username) = LOWER($1) OR LOWER(telegram_username) = LOWER('@' || $1)) AND id != $2`,
        [telegram, req.user.userId]
      );

      if (telegramCheck.rows.length > 0) {
        const acceptLanguage = req.headers['accept-language'];
        const userLanguage = acceptLanguage?.split(',')[0] || currentUser.language || 'ru';
        throw createError(400, 'VALIDATION_ERROR', getLocalizedErrorMessage('telegramExists', userLanguage));
      }
    }

    // Process avatar if provided — upload to Supabase Storage
    let avatarUrl = currentUser.avatar_url;

    if (avatar && avatar.startsWith("data:image")) {
      try {
        const base64Data = avatar.replace(/^data:image\/\w+;base64,/, "");
        const buffer = Buffer.from(base64Data, "base64");

        const optimizedBuffer = await sharp(buffer)
          .resize(400, 400, { fit: "cover" })
          .jpeg({ quality: 80 })
          .toBuffer();

        // Try Supabase Storage
        if (isStorageAvailable()) {
          const uploaded = await uploadAvatarBuffer(optimizedBuffer, req.user.userId);
          if (uploaded) avatarUrl = uploaded;
        }

        // Fallback: store as data URI
        if (avatarUrl === currentUser.avatar_url) {
          avatarUrl = `data:image/jpeg;base64,${optimizedBuffer.toString("base64")}`;
        }
      } catch (error) {
        console.error("Avatar processing error:", error);
      }
    }

    // Build update query
    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (firstName !== undefined) {
      updates.push(`first_name = $${paramIndex++}`);
      values.push(firstName);
    }
    if (lastName !== undefined) {
      updates.push(`last_name = $${paramIndex++}`);
      values.push(lastName);
    }
    if (phone !== undefined) {
      updates.push(`phone = $${paramIndex++}`);
      values.push(phone);
    }
    if (phoneCountry !== undefined) {
      updates.push(`phone_country = $${paramIndex++}`);
      values.push(phoneCountry);
    }
    if (telegram !== undefined) {
      updates.push(`telegram_username = $${paramIndex++}`);
      values.push(telegram || null);
    }
    if (avatarUrl !== currentUser.avatar_url) {
      updates.push(`avatar_url = $${paramIndex++}`);
      values.push(avatarUrl);
    }
    if (status !== undefined) {
      updates.push(`status = $${paramIndex++}`);
      values.push(status);
    }
    if (language !== undefined) {
      updates.push(`language = $${paramIndex++}`);
      values.push(language);
    }

    updates.push(`updated_at = NOW()`);
    values.push(req.user.userId);

    if (updates.length > 1) {
      const sql = `UPDATE users SET ${updates.join(', ')} WHERE id = $${paramIndex}`;
      await query(sql, values);
    }

    // Get updated user
    const updatedResult = await query(
      `SELECT id, first_name, last_name, phone, phone_country, telegram_username, avatar_url, status, language FROM users WHERE id = $1`,
      [req.user.userId],
    );

    const updatedUser = updatedResult.rows[0];

    res.json({
      success: true,
      user: {
        id: updatedUser.id,
        firstName: updatedUser.first_name,
        lastName: updatedUser.last_name,
        phone: updatedUser.phone,
        phoneCountry: updatedUser.phone_country,
        telegram: updatedUser.telegram_username,
        avatarUrl: updatedUser.avatar_url || null,
        status: updatedUser.status,
        language: updatedUser.language,
      },
    });

  } catch (error: any) {
    console.error("Error in updateMe:", error.message);

    // Localized createError
    if (error.statusCode === 400 && error.code === 'VALIDATION_ERROR') {
      return res.status(400).json({
        success: false,
        error: 'VALIDATION_ERROR',
        message: error.message
      });
    }

    // Unique constraint violation
    if (error.code === '23505') {
      const errorMessage = error.message?.toLowerCase() || '';
      const language = req.headers['accept-language'] || req.body.language || 'ru';

      if (errorMessage.includes('phone') || errorMessage.includes('users_phone_key')) {
        return res.status(400).json({
          success: false,
          error: 'VALIDATION_ERROR',
          message: getLocalizedErrorMessage('phoneExists', language)
        });
      } else if (errorMessage.includes('telegram') || errorMessage.includes('users_telegram_username_key')) {
        return res.status(400).json({
          success: false,
          error: 'VALIDATION_ERROR',
          message: getLocalizedErrorMessage('telegramExists', language)
        });
      }
    }

    return res.status(500).json({
      success: false,
      error: 'INTERNAL_ERROR',
      message: 'Failed to update profile'
    });
  }
};

export const updateLanguage = async (req: AuthRequest, res: Response) => {
  if (!req.user) {
    throw createError(401, 'UNAUTHORIZED', 'Authentication required');
  }

  try {
    const { language } = req.body;

    if (!language || !['ru', 'ky', 'en'].includes(language)) {
      return res.status(400).json({
        success: false,
        error: 'VALIDATION_ERROR',
        message: 'Invalid language. Must be one of: ru, ky, en'
      });
    }

    await query(
      'UPDATE users SET language = $1, updated_at = NOW() WHERE id = $2',
      [language, req.user.userId]
    );

    res.json({
      success: true,
      message: 'Language updated successfully'
    });
  } catch (error: any) {
    console.error('Error updating language:', error.message);
    res.status(500).json({
      success: false,
      error: 'INTERNAL_ERROR',
      message: 'Failed to update language'
    });
  }
};

export const subscribePush = async (req: AuthRequest, res: Response) => {
  if (!req.user) {
    throw createError(401, 'UNAUTHORIZED', 'Authentication required');
  }

  const { subscription } = req.body;
  const subObject = typeof subscription === 'string' ? JSON.parse(subscription) : subscription;

  await query(
    `UPDATE users SET push_subscription = $1, updated_at = NOW() WHERE id = $2`,
    [JSON.stringify(subObject), req.user.userId]
  );

  if (subObject && subObject.endpoint && subObject.keys) {
    try {
      await savePushSubscription(req.user.userId, subObject);
    } catch (err) {
      console.error('Failed to save in push_subscriptions table:', err);
    }
  }

  res.json({
    success: true,
  });
};
