import { Response } from 'express';

import { AuthRequest } from '../middleware/auth';

import { query } from '../config/database';

import { generateToken } from '../utils/jwt';

import { createError } from '../utils/errors';

import { validateQRToken, markQRAsUsed, getUserByQRToken } from '../services/qrService';

import { v4 as uuidv4 } from 'uuid';

import bcrypt from 'bcryptjs';

import sharp from 'sharp';

import path from 'path';

import fs from 'fs/promises';

import { validateRegistration } from '../utils/validation';

const UPLOAD_DIR = process.env.UPLOAD_DIR || './uploads';

// Функция для получения локализованного сообщения об ошибке
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
    },
    googleExists: {
      ru: 'Пользователь с таким Google аккаунтом уже существует',
      en: 'User with this Google account already exists',
      ky: 'Мындай Google аккаунту бар колдонуучу мурунтан эле бар'
    }
  };

  return errorMessages[errorKey]?.[lang] || errorMessages[errorKey]?.ru || errorKey;
};

/*
export const register = async (req: AuthRequest, res: Response) => {

  const {

    qrToken,

    firstName,

    lastName,

    phone,

    phoneCountry,

    telegram,

    avatar,

    status,

    language,
    email,
    googleId,
  } = req.body;



  console.log('Registration request:', {

    qrToken,

    firstName,

    lastName,

    phone,

    phoneCountry,

    telegram,

    hasAvatar: !!avatar,

    status,

    language,

  });



  // Validate QR token

  const qrValidation = await validateQRToken(qrToken);

  if (!qrValidation.valid) {

    console.error('Invalid QR token:', qrToken);

    throw createError(400, 'INVALID_QR', 'Invalid QR code');

  }



  if (qrValidation.used) {

    console.error('QR token already used:', qrToken);

    throw createError(400, 'QR_ALREADY_USED', 'QR code already registered');

  }



  // Check if phone already exists

  const phoneCheck = await query(

    `SELECT id FROM users WHERE phone = $1 AND phone_country = $2`,

    [phone, phoneCountry]

  );



  if (phoneCheck.rows.length > 0) {

    // Получаем язык из запроса
    const userLanguage = req.headers['accept-language']?.split(',')[0] || language || 'ru';

    throw createError(400, 'VALIDATION_ERROR', getLocalizedErrorMessage('phoneExists', userLanguage));

  }



  // Check if Telegram username already exists

  if (telegram && telegram.trim() !== '') {

    const telegramCheck = await query(

      `SELECT id FROM users WHERE LOWER(telegram_username) = LOWER($1)`,

      [telegram.trim()]

    );



    if (telegramCheck.rows.length > 0) {

      // Получаем язык из запроса
      const userLanguage = req.headers['accept-language']?.split(',')[0] || language || 'ru';

      throw createError(400, 'VALIDATION_ERROR', getLocalizedErrorMessage('telegramExists', userLanguage));

    }

  }

  // Check if Google account already exists and is active
  if (googleId || email) {
    const googleCheck = await query(
      `SELECT id, is_active, created_at FROM users WHERE google_id = $1 OR email = $2`,
      [googleId || null, email || null]
    );

    if (googleCheck.rows.length > 0) {
      const existingUser = googleCheck.rows[0];
      const isExpired = (Date.now() - new Date(existingUser.created_at).getTime()) > 365 * 24 * 60 * 60 * 1000;
      const isActive = existingUser.is_active && !isExpired;

      if (isActive) {
        const userLanguage = req.headers['accept-language']?.split(',')[0] || language || 'ru';
        throw createError(400, 'VALIDATION_ERROR', getLocalizedErrorMessage('googleExists', userLanguage));
      }
    }
  }



  // Validate avatar (required)
  if (!avatar) {
    throw createError(400, 'VALIDATION_ERROR', 'Avatar photo is required');
  }

  let avatarUrl = null;

  if (avatar.startsWith('http')) {
    avatarUrl = avatar;
  } else if (avatar.startsWith('data:image')) {
    try {
      await fs.mkdir(UPLOAD_DIR, { recursive: true });
      const userId = uuidv4();
      const avatarFilename = `${userId}-${Date.now()}.jpg`;
      const avatarPath = path.join(UPLOAD_DIR, avatarFilename);

      const base64Data = avatar.replace(/^data:image\/[a-z]+;base64,/, '');
      const buffer = Buffer.from(base64Data, 'base64');

      if (buffer.length === 0) {
        throw new Error('Invalid base64 image data');
      }

      await sharp(buffer)
        .resize(400, 400, { fit: 'cover' })
        .jpeg({ quality: 80 })
        .toFile(avatarPath);

      avatarUrl = `/uploads/${avatarFilename}`;
    } catch (error: any) {
      console.error('Avatar processing error:', error);
      throw createError(400, 'VALIDATION_ERROR', `Failed to process avatar image: ${error.message}`);
    }
  } else {
    throw createError(400, 'VALIDATION_ERROR', 'Invalid avatar format');
  }



  // Create user

  const userId = uuidv4();

  const telegramValue = telegram && telegram.trim() !== '' ? telegram.trim() : null;



  try {

    await query(
      `INSERT INTO users (
        id, qr_token, first_name, last_name, phone, phone_country,
        telegram_username, avatar_url, status, language, email, google_id, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW(), NOW())`,
      [
        userId,
        qrToken,
        firstName.trim(),
        lastName.trim(),
        phone.trim(),
        phoneCountry,
        telegramValue,
        avatarUrl,
        status,
        language || 'ru',
        email,
        googleId
      ]
    );

  } catch (dbError: any) {

    console.error('Database error during registration:', dbError);

    if (dbError.code === '23505') { // Unique violation

      // Определяем тип ошибки по сообщению и возвращаем локализованное сообщение
      const errorMessage = dbError.message?.toLowerCase() || '';
      const language = req.headers['accept-language'] || req.body.language || 'ru';

      if (errorMessage.includes('phone') || errorMessage.includes('users_phone_key')) {
        const localizedMessage = getLocalizedErrorMessage('phoneExists', language);
        throw createError(400, 'VALIDATION_ERROR', localizedMessage);
      } else if (errorMessage.includes('telegram') || errorMessage.includes('users_telegram_username_key')) {
        const localizedMessage = getLocalizedErrorMessage('telegramExists', language);
        throw createError(400, 'VALIDATION_ERROR', localizedMessage);
      } else {
        const localizedMessage = getLocalizedErrorMessage('phoneExists', language);
        throw createError(400, 'VALIDATION_ERROR', localizedMessage);
      }

    }

    throw createError(500, 'INTERNAL_ERROR', 'Failed to create user');

  }



  // Mark QR as used

  await markQRAsUsed(qrToken, userId);



  // Generate token

  const token = generateToken({ userId });



  res.json({

    success: true,

    user: {

      id: userId,

      firstName,

      lastName,

      phone,

      phoneCountry,

      telegram,

      avatarUrl,

      status,

      language,

    },

    token,

  });

};
*/

export const login = async (req: AuthRequest, res: Response) => {

  const { qrToken, phone, password } = req.body;



  // If QR token provided, use QR login

  if (qrToken) {

    const qrValidation = await validateQRToken(qrToken);

    if (!qrValidation.valid || !qrValidation.used) {

      throw createError(400, 'INVALID_QR', 'Invalid or unused QR code');

    }



    if (!qrValidation.userId) {

      throw createError(400, 'INVALID_QR', 'QR code not associated with user');

    }



    const userResult = await query(`SELECT id, qr_token, first_name, last_name, phone, phone_country, telegram_username, avatar_url, status, language, email_notifications, push_notifications, telegram_notifications, created_at, updated_at, last_login FROM users WHERE id = $1`, [

      qrValidation.userId,

    ]);



    if (userResult.rows.length === 0) {

      throw createError(404, 'NOT_FOUND', 'User not found');

    }



    const user = userResult.rows[0];

    const token = generateToken({ userId: user.id });



    res.json({

      success: true,

      user: {

        id: user.id,

        firstName: user.first_name,

        lastName: user.last_name,

        phone: user.phone,

        phoneCountry: user.phone_country,

        telegram: user.telegram_username,

        avatarUrl: user.avatar_url,

        status: user.status,

        language: user.language,

      },

      token,

    });

    return;

  }



  // Phone/password login

  if (!phone) {

    throw createError(400, 'VALIDATION_ERROR', 'Phone is required');

  }



  const userResult = await query(`SELECT id, qr_token, first_name, last_name, phone, phone_country, telegram_username, avatar_url, status, language, email_notifications, push_notifications, telegram_notifications, created_at, updated_at, last_login FROM users WHERE phone = $1`, [phone]);



  if (userResult.rows.length === 0) {

    throw createError(401, 'UNAUTHORIZED', 'Invalid credentials');

  }



  const user = userResult.rows[0];



  // For now, we'll allow login without password since users don't have passwords yet

  // In production, you should implement proper password authentication

  const token = generateToken({ userId: user.id });



  res.json({

    success: true,

    user: {

      id: user.id,

      firstName: user.first_name,

      lastName: user.last_name,

      phone: user.phone,

      phoneCountry: user.phone_country,

      telegram: user.telegram,

      avatarUrl: user.avatar_url,

      status: user.status,

      language: user.language,

    },

    token,

  });

};



export const adminLogin = async (req: AuthRequest, res: Response) => {

  const { username, password } = req.body;



  const result = await query(`SELECT * FROM admins WHERE username = $1`, [

    username,

  ]);



  if (result.rows.length === 0) {

    throw createError(401, 'UNAUTHORIZED', 'Invalid credentials');

  }



  const admin = result.rows[0];

  const isValid = await bcrypt.compare(password, admin.password_hash);



  if (!isValid) {

    throw createError(401, 'UNAUTHORIZED', 'Invalid credentials');

  }



  // Update last login

  await query(`UPDATE admins SET last_login = NOW() WHERE id = $1`, [admin.id]);



  const { generateAdminToken } = require('../utils/jwt');

  const token = generateAdminToken({ userId: admin.id, type: 'admin' });



  res.json({

    success: true,

    token,

    admin: {

      id: admin.id,

      username: admin.username,

    },

  });

};



export const googleLogin = async (req: AuthRequest, res: Response) => {
  const qrToken = req.query.qrToken as string || "";
  const googleClientId = process.env.GOOGLE_CLIENT_ID;
  const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;

  const host = req.get('host');
  let frontendUrl = process.env.CORS_ORIGIN || process.env.FRONTEND_URL || "http://localhost:3001";
  if (host && !host.includes('localhost') && !host.includes('127.0.0.1')) {
    const proto = req.headers['x-forwarded-proto'] || req.protocol || 'https';
    frontendUrl = `${proto}://${host}`;
  }

  if (!googleClientId || !googleClientSecret) {
    console.error("Missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET in env variables");
    return res.redirect(`${frontendUrl}/login?error=server_error`);
  }
  let redirectUri = process.env.GOOGLE_REDIRECT_URI || `${req.protocol}://${req.get('host')}/api/v1/auth/google/callback`;
  if (host && !host.includes('localhost') && !host.includes('127.0.0.1')) {
    const proto = req.headers['x-forwarded-proto'] || req.protocol || 'https';
    redirectUri = `${proto}://${host}/api/v1/auth/google/callback`;
  }

  const scope = encodeURIComponent("profile email");
  const state = encodeURIComponent(qrToken);
  const responseType = "code";
  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${googleClientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=${responseType}&scope=${scope}&state=${state}&prompt=select_account`;
  
  res.redirect(authUrl);
};

export const googleCallback = async (req: AuthRequest, res: Response) => {
  const code = req.query.code as string;
  const qrToken = req.query.state as string || "";
  const googleClientId = process.env.GOOGLE_CLIENT_ID;
  const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;
  
  let redirectUri = process.env.GOOGLE_REDIRECT_URI || `${req.protocol}://${req.get('host')}/api/v1/auth/google/callback`;
  const host = req.get('host');
  if (host && !host.includes('localhost') && !host.includes('127.0.0.1')) {
    const proto = req.headers['x-forwarded-proto'] || req.protocol || 'https';
    redirectUri = `${proto}://${host}/api/v1/auth/google/callback`;
  }

  let frontendUrl = process.env.CORS_ORIGIN || "http://localhost:3001";
  if (host && !host.includes('localhost') && !host.includes('127.0.0.1')) {
    const proto = req.headers['x-forwarded-proto'] || req.protocol || 'https';
    frontendUrl = `${proto}://${host}`;
  }

  if (!code) {
    return res.redirect(`${frontendUrl}/login?error=no_code_provided`);
  }

  try {
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        code,
        client_id: googleClientId || "",
        client_secret: googleClientSecret || "",
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }).toString(),
    });

    const tokenData: any = await tokenResponse.json();
    if (!tokenResponse.ok || !tokenData.access_token) {
      console.error("Google token exchange failed:", tokenData);
      return res.redirect(`${frontendUrl}/login?error=token_exchange_failed`);
    }

    const profileResponse = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
      },
    });

    const profileData: any = await profileResponse.json();
    if (!profileResponse.ok || !profileData.email) {
      console.error("Google profile fetch failed:", profileData);
      return res.redirect(`${frontendUrl}/login?error=profile_fetch_failed`);
    }

    const email = profileData.email;
    const googleId = profileData.sub;
    const firstName = profileData.given_name || "Google User";
    const lastName = profileData.family_name || "";
    const avatarUrl = profileData.picture || null;

    let userQuery = await query(
      "SELECT id, qr_token, first_name, last_name, phone, phone_country, telegram_username, avatar_url, status, language, is_active, created_at FROM users WHERE google_id = $1 OR email = $2",
      [googleId, email]
    );

    let user = userQuery.rows[0];

    // If user not found by Google ID or Email, but we have a qrToken,
    // let's see if we can find the user by qrToken to link their account
    if (!user && qrToken) {
      const qrUserQuery = await query(
        "SELECT id, qr_token, first_name, last_name, phone, phone_country, telegram_username, avatar_url, status, language, google_id, email, is_active, created_at FROM users WHERE qr_token = $1",
        [qrToken]
      );
      user = qrUserQuery.rows[0];
    }

    if (user) {
      // Check if they scanned a new/different QR code
      if (qrToken && user.qr_token !== qrToken) {
        // If the user is active, we should NOT allow using this Google account for a new registration.
        const isExpired = (Date.now() - new Date(user.created_at).getTime()) > 365 * 24 * 60 * 60 * 1000;
        const isActive = user.is_active && !isExpired;
        if (isActive) {
          return res.redirect(`${frontendUrl}/login?error=google_account_exists`);
        }

        // Check if the scanned QR token is valid and unused
        const qrValidation = await validateQRToken(qrToken);
        if (qrValidation.valid && !qrValidation.used) {
          // Re-link user to new QR token and renew subscription (created_at = NOW(), is_active = true)
          await query(
            `UPDATE users 
             SET qr_token = $1, is_active = TRUE, created_at = NOW(), updated_at = NOW(), google_id = COALESCE(google_id, $2), email = COALESCE(email, $3) 
             WHERE id = $4`,
            [qrToken, googleId, email, user.id]
          );
          await markQRAsUsed(qrToken, user.id);
        } else if (user.qr_token) {
          // If the scanned QR code is invalid or used by someone else, return error
          return res.redirect(`${frontendUrl}/login?error=account_linked_to_different_qr`);
        }
      } else if (!user.google_id || !user.email) {
        await query(
          "UPDATE users SET google_id = $1, email = $2 WHERE id = $3",
          [googleId, email, user.id]
        );
      }
      
      const token = generateToken({ userId: user.id });
      return res.redirect(`${frontendUrl}/login-success?token=${token}`);
    }

    if (qrToken) {
      const qrValidation = await validateQRToken(qrToken);
      if (qrValidation.valid && !qrValidation.used) {
        const params = new URLSearchParams({
          token: qrToken,
          email,
          googleId,
          firstName,
          lastName,
          avatarUrl: avatarUrl || "",
        });
        return res.redirect(`${frontendUrl}/qr?${params.toString()}`);
      }
    }

    // If we reach here, it means no user was found, and either there's no qrToken, or it's invalid/used.
    // The user should not be able to log in without a registered account.
    return res.redirect(`${frontendUrl}/login?error=user_not_found`);

  } catch (error) {
    console.error("Error during Google Callback:", error);
    return res.redirect(`${frontendUrl}/login?error=server_error`);
  }
};

