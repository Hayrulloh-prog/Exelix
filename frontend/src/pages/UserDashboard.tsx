import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import toast from "react-hot-toast";
import { API_ENDPOINTS, API_BASE_URL } from "../lib/api";
import UserDataSync from "../lib/userDataSync";
import AvatarUpload from "../lib/avatarUpload";
import { PushNotificationPrompt } from "../components/PushNotificationPrompt";
import {
  Phone,
  Camera,
  User,
  X,
  AlertCircle,
  Download,
  Settings,
  Lock,
  Unlock,
  Edit,
  Sparkles,
  Crown,
  Send,
  Bell,
} from "lucide-react";

interface UserData {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  phoneCountry?: string;
  telegram: string | undefined;
  status: "open" | "closed";
  avatarUrl?: string;
  language?: string;
  isExpired?: boolean;
  isBlocked?: boolean;
}

interface UpdateUserData {
  firstName: string | undefined;
  lastName: string | undefined;
  phone: string;
  phoneCountry?: string;
  telegram: string | undefined | null;
  status: "open" | "closed";
  avatar?: string;
}

export function UserDashboard() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [user, setUser] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState<Partial<UserData>>({});
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [hasNewNotifications, setHasNewNotifications] = useState(false);
  const [showTelegramModal, setShowTelegramModal] = useState(false);
  const [telegramInput, setTelegramInput] = useState("");

  // Helper to get the best available avatar URL
  const getAvatarUrl = (userData: UserData | null): string | null => {
    if (!userData) return null;
    return userData.avatarUrl || null;
  };

  // Прослушиватель для новых уведомлений от NotificationPage
  useEffect(() => {
    const handleNewNotification = () => {
      setHasNewNotifications(true);
    };

    const handleNotificationsRead = () => {
      setHasNewNotifications(false);
    };

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'newNotification' && e.newValue === 'true') {
        setHasNewNotifications(true);
        localStorage.removeItem('newNotification');
      }
      if (e.key === 'notificationsRead' && e.newValue === 'true') {
        setHasNewNotifications(false);
        localStorage.removeItem('notificationsRead');
      }
    };

    window.addEventListener('newNotification', handleNewNotification);
    window.addEventListener('notificationsRead', handleNotificationsRead);
    window.addEventListener('storage', handleStorageChange);

    // Добавляем проверку через интервал для надежности
    const interval = setInterval(() => {
      const newNotif = localStorage.getItem('newNotification');
      const readNotif = localStorage.getItem('notificationsRead');

      if (newNotif === 'true' && !hasNewNotifications) {
        setHasNewNotifications(true);
        localStorage.removeItem('newNotification');
      }

      if (readNotif === 'true' && hasNewNotifications) {
        setHasNewNotifications(false);
        localStorage.removeItem('notificationsRead');
      }
    }, 1000);

    // Добавляем слушатель для изменения языка
    const handleLanguageChanged = (event: CustomEvent) => {
      // Принудительно перерисовываем компонент для обновления переводов
      setUser(prev => prev ? { ...prev } : null);
      setEditForm(prev => prev ? { ...prev } : {
        firstName: '',
        lastName: '',
        phone: '',
        telegram: '',
        status: 'open'
      });
    };

    window.addEventListener('languageChanged' as any, handleLanguageChanged);

    const fetchUnreadCount = async () => {
      const token = localStorage.getItem("userToken") || localStorage.getItem("token");
      if (!token) return;
      try {
        const response = await fetch(`${API_BASE_URL}/v1/notifications/unread-count`, {
          headers: {
            Authorization: `Bearer ${token}`
          }
        });
        if (response.ok) {
          const data = await response.json();
          if (data.success) {
            setHasNewNotifications(data.count > 0);
          }
        }
      } catch (err) {
        // Ignore network errors in background poll
      }
    };

    // Initial check
    fetchUnreadCount();

    // Poll every 5 seconds
    const unreadInterval = setInterval(fetchUnreadCount, 5000);

    return () => {
      window.removeEventListener('newNotification', handleNewNotification);
      window.removeEventListener('notificationsRead', handleNotificationsRead);
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('languageChanged' as any, handleLanguageChanged);
      clearInterval(interval);
      clearInterval(unreadInterval);
    };
  }, []);

  useEffect(() => {
    const token =
      localStorage.getItem("userToken") || localStorage.getItem("token");

    if (!token) {
      navigate("/");
      return;
    }

    const fetchUserData = async () => {
      try {

        // Всегда сначала грузим из API для актуальных данных
        const response = await fetch(`${API_BASE_URL}/v1/users/me`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (response.ok) {
          const apiUserData = await response.json();

          // Исправляем относительные URL для аватара
          if (
            apiUserData.avatarUrl &&
            (apiUserData.avatarUrl.startsWith("/api/") || apiUserData.avatarUrl.startsWith("http"))
          ) {
            // Если URL уже абсолютный (http/https), используем как есть
            // Если относительный, добавляем базовый URL API
            apiUserData.avatarUrl = apiUserData.avatarUrl.startsWith("http")
              ? apiUserData.avatarUrl
              : `${API_BASE_URL}${apiUserData.avatarUrl}`;
          }

          // Сохраняем свежие данные в localStorage
          UserDataSync.save(apiUserData);

          // Убедимся что у объекта есть поле telegram с правильным значением
          const userWithTelegram = {
            ...apiUserData,
            telegram: apiUserData.telegram || "",
          };

          setUser(userWithTelegram);
          setEditForm({
            ...userWithTelegram,
            telegram: cleanTelegramForEdit(userWithTelegram.telegram)
          });
        } else {
          // Fallback to localStorage if API fails
          const localUserData = UserDataSync.load();
          if (localUserData) {
            const userWithTelegram = {
              ...localUserData,
              telegram: localUserData.telegram || "",
            };
            setUser(userWithTelegram);
            setEditForm({
              ...userWithTelegram,
              telegram: cleanTelegramForEdit(userWithTelegram.telegram)
            });
          } else {
            navigate("/");
            return;
          }
        }
      } catch (error) {
        // Fallback to localStorage on error
        const localUserData = UserDataSync.load();
        if (localUserData) {
          const userWithTelegram = {
            ...localUserData,
            telegram: localUserData.telegram || "",
          };
          setUser(userWithTelegram);
          setEditForm({
            ...userWithTelegram,
            telegram: cleanTelegramForEdit(userWithTelegram.telegram)
          });
        } else {
          navigate("/");
          return;
        }
      } finally {
        setLoading(false);
      }
    };

    fetchUserData();
  }, [navigate]);

  // Обработчик для PWA установки
  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      (window as any).deferredPrompt = e;
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    };
  }, []);

  const handleEdit = () => {
    setEditing(true);
    setEditForm({
      ...user,
      telegram: cleanTelegramForEdit(user?.telegram || ""),
    });
  };

  const handleCancel = () => {
    setEditing(false);
    setAvatarPreview(null);
    setEditForm({
      ...user,
      telegram: cleanTelegramForEdit(user?.telegram || ""),
    });
  };

  // Helper to clean telegram username (remove @ for editing)
  const cleanTelegramForEdit = (telegram?: string) => {
    if (!telegram) return undefined;
    const cleaned = telegram.replace(/^@+/, "");
    return cleaned || undefined; // Если после очистки пусто, возвращаем undefined
  };

  const formatPhoneNumber = (phone: string): string => {
    // Если уже начинается с +, возвращаем как есть
    if (phone.startsWith("+")) {
      return phone;
    }

    // Убираем все нецифровые символы
    const cleanPhone = phone.replace(/\D/g, '');

    // Определяем страну по первым цифрам
    if (cleanPhone.startsWith('9') && cleanPhone.length === 9) {
      // Кыргызстан: 9XX XXX XXX -> +9969XX XXX XXX
      return `+996${cleanPhone}`;
    } else if (cleanPhone.startsWith('5') && cleanPhone.length === 9) {
      // Кыргызстан: 5XX XXX XXX -> +9965XX XXX XXX
      return `+996${cleanPhone}`;
    } else if (cleanPhone.startsWith('0') && cleanPhone.length === 9) {
      // Кыргызстан: 0XX XXX XXX -> +996XX XXX XXX (убираем ведущий 0)
      return `+996${cleanPhone.substring(1)}`;
    } else if (cleanPhone.startsWith('0') && cleanPhone.length === 10) {
      // Кыргызстан: 0XXX XXX XXX -> +996XXX XXX XXX (убираем ведущий 0)
      return `+996${cleanPhone.substring(1)}`;
    } else if (cleanPhone.startsWith('5') && cleanPhone.length === 10) {
      // Кыргызстан: 5XXX XXX XXX -> +9965XXX XXX XXX
      return `+996${cleanPhone}`;
    } else if (cleanPhone.startsWith('9') && cleanPhone.length === 10) {
      // Россия: 9XX XXX XX XX -> +79XX XXX XX XX
      return `+7${cleanPhone}`;
    } else if (cleanPhone.startsWith('4') && cleanPhone.length === 9) {
      // Кыргызстан: 4XX XXX XXX -> +9964XX XXX XXX
      return `+996${cleanPhone}`;
    } else if (cleanPhone.startsWith('3') && cleanPhone.length === 9) {
      // Кыргызстан: 3XX XXX XXX -> +9963XX XXX XXX
      return `+996${cleanPhone}`;
    } else if (cleanPhone.startsWith('2') && cleanPhone.length === 9) {
      // Кыргызстан: 2XX XXX XXX -> +9962XX XXX XXX
      return `+996${cleanPhone}`;
    } else if (cleanPhone.startsWith('8') && cleanPhone.length === 10) {
      // Россия: 8XXX XXX XX XX -> +7XXX XXX XX XX
      return `+7${cleanPhone.substring(1)}`;
    } else if (cleanPhone.length === 11 && cleanPhone.startsWith('7')) {
      // Россия: 7XXX XXX XX XX -> +7XXX XXX XX XX
      return `+${cleanPhone}`;
    } else if (cleanPhone.length === 12 && cleanPhone.startsWith('996')) {
      // Кыргызстан: 996XXX XXX XX -> +996XXX XXX XX
      return `+${cleanPhone}`;
    } else {
      // По умолчанию считаем кыргызским номером
      return `+996${cleanPhone}`;
    }
  };

  const handleSave = async () => {
    if (!user) return;


    try {
      // Проверяем, изменились ли номер телефона или Telegram
      const formattedPhone = editForm.phone ? formatPhoneNumber(editForm.phone).replace(/\s/g, '') : "";
      const phoneChanged = formattedPhone !== user.phone;

      // Для Telegram сравниваем очищенные значения (без @) для валидации
      const currentTelegramClean = (user.telegram || "").replace(/^@+/, "");
      const editTelegramClean = (editForm.telegram || "").replace(/^@+/, "");
      const telegramChanged = editTelegramClean !== currentTelegramClean;

      // Если номер телефона изменился, проверяем его существование
      if (phoneChanged) {
        try {
          const token = localStorage.getItem("userToken") || localStorage.getItem("token");
          const checkResponse = await fetch(API_ENDPOINTS.CHECK_PHONE, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ phone: formattedPhone }),
          });

          if (checkResponse.ok) {
            const checkData = await checkResponse.json();
            if (checkData.exists && checkData.userId !== user.id) {
              toast.error(t('dashboard.phoneExists'));
              setEditForm(prev => ({ ...prev, phone: user.phone || '' }));
              return;
            } else {
            }
          }
        } catch (error) {
        }
      }

      if ((telegramChanged || editForm.telegram) && editTelegramClean) {
        try {
          const token = localStorage.getItem("userToken") || localStorage.getItem("token");


          const checkResponse = await fetch(API_ENDPOINTS.CHECK_TELEGRAM, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ telegram: editTelegramClean }),
          });


          if (checkResponse.ok) {
            const checkData = await checkResponse.json();


            if (checkData.exists && checkData.userId !== user.id) {

              toast.error(t('dashboard.telegramExists'));
              setEditForm(prev => ({ ...prev, telegram: user.telegram || '' }));
              return;
            } else {

            }
          } else {
          }
        } catch (error) {
        }
      } else {
      }

      // Валидация полей перед сохранением
      if (!editForm.firstName?.trim()) {
        toast.error(t('dashboard.firstNameRequired'));
        return;
      }

      if (!editForm.lastName?.trim()) {
        toast.error(t('dashboard.lastNameRequired'));
        return;
      }

      if (!formattedPhone?.trim()) {
        toast.error(t('dashboard.phoneRequired'));
        return;
      }

      // Собираем данные для обновления
      const updateData: UpdateUserData = {
        firstName: editForm.firstName,
        lastName: editForm.lastName,
        phone: formattedPhone,
        phoneCountry: user.phoneCountry || 'KG', // Добавляем страну телефона
        // Отправляем telegram как основное поле (бэкенд так ожидает)
        telegram: editForm.telegram ? cleanTelegramForEdit(editForm.telegram) : null, // Пустое поле = null (удаление)
        status: user.status, // Сохраняем текущий статус без изменений
      };

      // Добавляем аватар если есть изменения

      // Only include avatar in updateData if it's not already uploaded via AvatarUpload
      // AvatarUpload.upload already tries to save the avatar, so we don't need to send it again
      if (avatarPreview && avatarPreview.length > 0) {
        // Always include avatar if there's a new one (even if user had no avatar before)
        // Check if it's actually different from existing avatar
        const currentAvatar = getAvatarUrl(user);
        if (!currentAvatar || avatarPreview !== currentAvatar) {
          updateData.avatar = avatarPreview;
        } else {
        }
      } else {
      }


      const token =
        localStorage.getItem("userToken") || localStorage.getItem("token");

      if (!token) {
        toast.error(t('errors.unauthorized'));
        return;
      }


      // Пробуем разные эндпоинты для обновления
      const endpoints = [
        { url: API_ENDPOINTS.UPDATE_PROFILE, name: 'UPDATE_PROFILE' },
        { url: `${API_ENDPOINTS.GET_USER(user.id)}`, name: 'GET_USER(id)' },
        { url: API_ENDPOINTS.UPDATE_USER(user.id), name: 'UPDATE_USER(id)' },
      ];

      let success = false;
      let lastError = '';

      for (const endpoint of endpoints) {
        try {

          // Получаем язык более надежным способом
          const getCurrentLanguage = () => {
            // Приоритет: 1. i18next язык, 2. язык пользователя, 3. язык браузера, 4. русский по умолчанию
            const i18nextLang = localStorage.getItem('i18nextLng');
            const userLang = user?.language;
            const browserLang = navigator.language || (navigator as any).userLanguage;

            return i18nextLang || userLang || browserLang || 'ru';
          };

          const response = await fetch(endpoint.url, {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
              "Accept-Language": getCurrentLanguage(),
            },
            body: JSON.stringify(updateData),
          });


          if (response.ok) {
            const apiResponse = await response.json();

            // Обрабатываем успешный ответ
            await processSaveResponse(apiResponse);
            success = true;
            break;
          } else {
            const errorText = await response.text();

            // Пытаемся распарсить JSON ошибку
            let errorMessage = errorText;
            try {
              const errorJson = JSON.parse(errorText);
              if (errorJson.message) {
                errorMessage = errorJson.message;
                // Показываем конкретную ошибку от бэкенда
                toast.error(errorMessage);
                return; // Прерываем цикл, так как показали ошибку
              }
            } catch (parseError) {
            }

            lastError = `${endpoint.name}: ${response.status}`;
          }
        } catch (error) {
          lastError = `${endpoint.name}: ${error}`;
        }
      }

      if (!success) {
        throw new Error(`All endpoints failed. Last error: ${lastError}`);
      }

    } catch (error: any) {

      // Проверяем, есть ли конкретное сообщение об ошибке
      const errorMessage = error?.message || String(error);


      // Если ошибка уже локализована (пришла с бэкенда), показываем как есть
      // Проверяем только полностью локализованные сообщения (киргизские и русские)
      if (errorMessage.includes('Мындай телефон номери менен колдонуучу бар') ||

          errorMessage.includes('Пользователь с таким номером телефона уже существует') ||
          errorMessage.includes('Мындай Telegram аты менен колдонуучу бар') ||
          errorMessage.includes('Пользователь с таким никнеймом Telegram уже существует')) {
        toast.error(errorMessage);
        return;
      }

      // Если пришло английское сообщение, переводим его на текущий язык
      if (errorMessage.includes('User with this phone number already exists') ||
          errorMessage.includes('User with this Telegram username already exists')) {
        if (errorMessage.includes('phone')) {
          toast.error(t('dashboard.phoneAlreadyExists'));
        } else {
          toast.error(t('dashboard.telegramAlreadyExists'));
        }
        return;
      }

      // Если это общая ошибка существования телефона/Telegram на русском (старый формат)
      if ((errorMessage.includes('уже существует') && errorMessage.includes('телефона')) ||
          (errorMessage.includes('уже существует') && errorMessage.includes('phone')) ||
          (errorMessage.includes('already exists') && errorMessage.includes('phone'))) {
        toast.error(t('dashboard.phoneAlreadyExists'));
        return;
      }

      // Если это общая ошибка существования Telegram на русском (старый формат)
      if ((errorMessage.includes('уже существует') && (errorMessage.includes('Telegram') || errorMessage.includes('никнеймом'))) ||
          (errorMessage.includes('already exists') && errorMessage.includes('Telegram'))) {
        toast.error(t('dashboard.telegramAlreadyExists'));
        return;
      }

      // Если это наша ошибка валидации (для других языков)
      if (errorMessage.includes(t('dashboard.phoneAlreadyExists')) ||
          errorMessage.includes(t('dashboard.telegramAlreadyExists'))) {
        // Ошибка уже показана выше, ничего не делаем
        return;
      }

      // Для других ошибок показываем общее сообщение
      toast.error(`Ошибка сохранения: ${errorMessage}`);
    }
  };

  const processSaveResponse = async (apiResponse: any) => {

    // Проверяем что именно сохранилось в базе данных
    const updatedUserFromAPI = apiResponse.user || apiResponse;

    // Используем только актуальные данные из API - без объединения с локальными
    const finalUserData = {
      ...updatedUserFromAPI,
      // Исправляем относительные URL для аватара
      avatarUrl: (() => {
        const url = updatedUserFromAPI.avatarUrl;
        if (url && url.startsWith("/api/")) {
          return `${API_BASE_URL}${url}`;
        }
        return url;
      })(),
    };

    setUser(finalUserData);
    setEditForm({
      ...finalUserData,
      telegram: cleanTelegramForEdit(
        finalUserData.telegram || ""
      ),
    });

    // Сохраняем через UserDataSync
    UserDataSync.save(finalUserData);

    // Показываем успешное уведомление
    toast.success(t('dashboard.profileUpdated'));

    // Принудительно перезагружаем данные с сервера через 1 секунду
    setTimeout(async () => {
      try {
        const token = localStorage.getItem("userToken") || localStorage.getItem("token");
        const freshResponse = await fetch(`${API_BASE_URL}/v1/users/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (freshResponse.ok) {
          const freshData = await freshResponse.json();

          // Исправляем URL аватара если нужно
          if (freshData.avatarUrl && (freshData.avatarUrl.startsWith("/api/") || freshData.avatarUrl.startsWith("http"))) {
            freshData.avatarUrl = freshData.avatarUrl.startsWith("http")
              ? freshData.avatarUrl
              : `${API_BASE_URL}${freshData.avatarUrl}`;
          }

          setUser(freshData);
          UserDataSync.save(freshData);
        }
      } catch (error) {
      }
    }, 1000);

    // Сбрасываем превью после сохранения только если не было нового аватара
    if (!avatarPreview) {
      setAvatarPreview(null);
    }
    setEditing(false);
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      // Убедимся, что мы в режиме редактирования
      if (!editing) {
        setEditing(true);
        // Небольшая задержка чтобы состояние обновилось
        await new Promise((resolve) => setTimeout(resolve, 50));
      }

      // СРАЗУ показываем быстрый preview (оригинальный файл через FileReader)
      const quickPreviewPromise = new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = (event) => {
          const quickPreview = event.target?.result as string;
          // Добавляем слушатель для изменения языка
          setAvatarPreview(quickPreview);
          // Принудительно обновляем компонент
          setTimeout(() => {
            setAvatarPreview(quickPreview);
          }, 10);
          resolve(quickPreview);
        };
        reader.readAsDataURL(file);
      });

      // Параллельно сжимаем и конвертируем в base64 (финальная версия)
      const compressPromise = AvatarUpload.compressAndConvert(file);

      // Ждём обе операции
      const [, compressedBase64] = await Promise.all([
        quickPreviewPromise,
        compressPromise,
      ]);

      // Обновляем preview на сжатую версию
      setAvatarPreview(compressedBase64);

      // Универсальная загрузка - пробует все способы (асинхронно, не блокирует UI)
      const uploadResult = await AvatarUpload.upload(
        user!.id,
        compressedBase64,
      );

      if (uploadResult.success) {
        // Обновляем локальное состояние
        let avatarUrl = uploadResult.avatarUrl;

        // Если загружено на сервер, добавим cache-buster чтобы браузер обновил картинку
        if (uploadResult.method === "server") {
          avatarUrl = `${uploadResult.avatarUrl}?v=${Date.now()}`;

          // Обновляем данные пользователя через API после загрузки аватара
          try {
            const token = localStorage.getItem("userToken") || localStorage.getItem("token");
            const response = await fetch(API_ENDPOINTS.UPDATE_USER(user!.id), {
              method: "PUT",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify({ avatarUrl: uploadResult.avatarUrl }),
            });

            if (response.ok) {
              const apiResponse = await response.json();

              // Используем актуальные данные из API
              const updatedUserFromAPI = {
                ...user,
                ...apiResponse.user,
                // Исправляем относительные URL для аватара
                avatarUrl: apiResponse.user.avatarUrl?.startsWith("/api/") || apiResponse.user.avatarUrl?.startsWith("http")
                  ? (apiResponse.user.avatarUrl?.startsWith("http")
                      ? apiResponse.user.avatarUrl
                      : `${API_BASE_URL}${apiResponse.user.avatarUrl}`)
                  : apiResponse.user.avatarUrl,
              };

              setUser(updatedUserFromAPI);
              setEditForm({
                ...updatedUserFromAPI,
                telegram: cleanTelegramForEdit(updatedUserFromAPI.telegram)
              });

              UserDataSync.save(updatedUserFromAPI);
            }
          } catch (error) {
          }
        }

        const updatedUser = {
          ...user!,
          avatarUrl,
        };

        // Если не удалось обновить через API, используем локальное обновление
        if (uploadResult.method !== "server") {
          setUser(updatedUser);
          setEditForm({
            ...updatedUser,
            telegram: cleanTelegramForEdit(updatedUser.telegram)
          });
        }

        // Если загружено на сервер - обновляем данные пользователя, но сохраняем preview если он есть
        if (uploadResult.method === "server") {
        } else {
          // Если только локально - сохраняем preview для отображения
          setAvatarPreview(compressedBase64);
          // Уведомление убрано по просьбе пользователя
        }

        UserDataSync.save(updatedUser);
      } else {
        throw new Error(uploadResult.error || t('errors.avatarUploadError'));
      }
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("dashboard.profileUpdateError"),
        { id: "avatar-upload" },
      );
    }
  };

  const installPWA = async () => {

    // Проверяем, есть ли отложенный prompt для установки
    let deferredPrompt = (window as any).deferredPrompt;

    // Если на localhost и нет deferred prompt, создаем тестовый
    if (!deferredPrompt && (location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
      deferredPrompt = {
        prompt: () => {
          return Promise.resolve({ outcome: 'accepted' });
        },
        userChoice: Promise.resolve({ outcome: 'accepted' })
      };
      (window as any).deferredPrompt = deferredPrompt;
    }

    if (deferredPrompt) {
      try {
        // Показываем диалог установки
        await deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        (window as any).deferredPrompt = null;

        if (outcome === "accepted") {
          toast.success(t('dashboard.pwaInstallSuccess'), {
            duration: 4000,
            style: {
              background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
              color: '#fff',
              fontSize: '16px',
              fontWeight: '600',
              borderRadius: '12px',
              padding: '16px 20px',
              boxShadow: '0 10px 25px rgba(16, 185, 129, 0.3)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
            },
          });
        } else {
          toast.success("Установка отменена");
        }
      } catch (error) {
        toast.error("Ошибка установки PWA. Попробуйте обновить страницу.");
      }
    } else {

      // Определяем устройство для конкретных инструкций
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
      const isAndroid = /Android/.test(navigator.userAgent);
      const isDesktop = !isIOS && !isAndroid; // Определяем десктоп

      if (isIOS) {
        toast.success("📱 iPhone/iPad: Нажмите 'Поделиться' → 'На экран 'Домой''", {
          duration: 7000,
          style: {
            background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
            color: '#fff',
            fontSize: '14px',
            fontWeight: '500',
            borderRadius: '12px',
            padding: '16px 20px',
            boxShadow: '0 10px 25px rgba(59, 130, 246, 0.3)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
          },
        });
      } else if (isAndroid) {
        toast.success("📱 Android: Нажмите '⋮' → 'Установить приложение' или 'Добавить на главный экран'", {
          duration: 6000,
          style: {
            background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
            color: '#fff',
            fontSize: '14px',
            fontWeight: '500',
            borderRadius: '12px',
            padding: '16px 20px',
            boxShadow: '0 10px 25px rgba(16, 185, 129, 0.3)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
          },
        });
      } else if (isDesktop) {
        // Для десктопных браузеров (Chrome, Edge, Firefox)
        toast.success("🖥️ Ноутбук/ПК: Нажмите на иконку 'Установить' в адресной строке или '⋮' → 'Установить приложение'", {
          duration: 8000,
          style: {
            background: 'linear-gradient(135deg, #1e40af 0%, #3b82f6 100%)',
            color: '#fff',
            fontSize: '14px',
            fontWeight: '500',
            borderRadius: '12px',
            padding: '16px 20px',
            boxShadow: '0 10px 25px rgba(30, 64, 175, 0.3)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
          },
        });
      } else {
        // Для desktop показываем инструкции
        toast.success("🖥️ Desktop: Нажмите на иконку скачивания в адресной строке или установите через меню браузера", {
          duration: 7000,
          style: {
            background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
            color: '#fff',
            fontSize: '14px',
            fontWeight: '500',
            borderRadius: '12px',
            padding: '16px 20px',
            boxShadow: '0 10px 25px rgba(30, 64, 175, 0.3)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
          },
        });
      }
    }
  };

  const handleTelegramAdd = async () => {
    if (!user) return;

    try {
      // Если поле пустое, сохраняем null, иначе убираем @ и сохраняем
      const telegramUsername = telegramInput.trim()
        ? telegramInput.replace("@", "")
        : null;

      // Отправляем запрос на обновление в базу данных
      const token =
        localStorage.getItem("userToken") || localStorage.getItem("token");
      const response = await fetch(API_ENDPOINTS.UPDATE_USER(user.id), {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ telegram: telegramUsername }),
      });

      let updatedUser;
      if (response.ok) {
        // Получаем обновленные данные от API
        const apiResponse = await response.json();
        updatedUser = {
          ...apiResponse.user,
          // Гарантируем что telegramUsername сохраняется
          telegramUsername: telegramUsername,
        };

        // Показываем соответствующее сообщение
        if (telegramUsername) {
          toast.success(t("dashboard.telegramAdded"));
        } else {
          toast.success(t("dashboard.telegramRemoved"));
        }
      } else {
        // Если API не сработало, обновляем локально
        updatedUser = {
          ...user,
          telegramUsername: telegramUsername,
          // Для совместимости добавляем и telegram поле
          telegram: telegramUsername,
        };

        // Показываем соответствующее сообщение
        if (telegramUsername) {
          toast.success(t("dashboard.telegramAdded"));
        } else {
          toast.success(t("dashboard.telegramRemoved"));
        }
      }

      setUser(updatedUser);
      setEditForm({
        ...updatedUser,
        telegram: cleanTelegramForEdit(updatedUser.telegram)
      });

      // Сохраняем через UserDataSync
      UserDataSync.save(updatedUser);

      setShowTelegramModal(false);
      setTelegramInput("");
    } catch (error) {
      toast.error(t("dashboard.profileUpdateError"));
    }
  };

  const toggleStatus = async () => {
    if (!user) return;

    try {
      const newStatus = user.status === "open" ? "closed" : "open";

      // Отправляем запрос на обновление в базу данных
      const token =
        localStorage.getItem("userToken") || localStorage.getItem("token");
      const response = await fetch(API_ENDPOINTS.UPDATE_PROFILE, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status: newStatus }),
      });

      let updatedUser;
      if (response.ok) {
        // Получаем обновленные данные от API
        const apiResponse = await response.json();
        updatedUser = apiResponse.user; // Берем user из ответа
        toast.success(t("dashboard.statusChanged"));
      } else {
        // Если API не сработало, обновляем локально
        updatedUser = { ...user, status: newStatus as "open" | "closed" };
        toast.success(t("dashboard.statusChanged"));
      }

      setUser(updatedUser);
      setEditForm({
        ...updatedUser,
        telegram: cleanTelegramForEdit(updatedUser.telegram)
      });

      // Отправляем событие об изменении статуса владельца для обновления NotificationPage
      window.dispatchEvent(new CustomEvent('ownerStatusChanged', {
        detail: {
          userId: updatedUser.id,
          newStatus: updatedUser.status,
          previousStatus: user?.status
        }
      }));

      // Также сохраняем в localStorage для синхронизации между вкладками
      localStorage.setItem('ownerStatusChanged', JSON.stringify({
        userId: updatedUser.id,
        newStatus: updatedUser.status,
        previousStatus: user?.status,
        timestamp: Date.now()
      }));

      // Сохраняем через UserDataSync
      UserDataSync.save(updatedUser);
    } catch (error) {
      toast.error(t("dashboard.profileUpdateError"));
    }
  };

  if (loading) {
    return (
      <div className="flex-1 hero-gradient flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 sm:w-16 sm:h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-6"></div>
          <p className="text-lg font-normal text-gray-700 dark:text-gray-300">
            {t("common.loading")}
          </p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex-1 hero-gradient flex items-center justify-center p-4">
        <div className="text-center feature-card max-w-md">
          <div className="w-16 h-16 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center mx-auto mb-6">
            <AlertCircle className="w-8 h-8 text-red-600 dark:text-red-400" />
          </div>
          <h2 className="text-2xl font-normal text-gray-900 dark:text-white mb-3">
            {t("dashboard.userNotFound")}
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            {t("common.tryAgain")}
          </p>
          <button
            onClick={() => navigate("/")}
            className="btn btn-primary w-full"
          >
            {t("dashboard.backToHome")}
          </button>
        </div>
      </div>
    );
  }

  if (user.isBlocked) {
    return (
      <div className="flex-1 h-full overflow-hidden hero-gradient flex flex-col relative w-full">
        <main className="flex-1 flex flex-col items-center justify-center p-4">
          <div className="text-center feature-card max-w-md w-full">
            <div className="w-16 h-16 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center mx-auto mb-6">
              <AlertCircle className="w-8 h-8 text-red-600 dark:text-red-400" />
            </div>
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">
              {t('subscription.blockedTitle')}
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              {t('subscription.blockedMessage')}
            </p>
            <button
              onClick={() => navigate("/")}
              className="btn btn-primary w-full"
            >
              {t('subscription.backToHome')}
            </button>
          </div>
        </main>
      </div>
    );
  }

  if (user.isExpired) {
    return (
      <div className="flex-1 h-full overflow-hidden hero-gradient flex flex-col relative w-full">
        <main className="flex-1 flex flex-col items-center justify-center p-4">
          <div className="text-center feature-card max-w-md w-full">
            <div className="w-16 h-16 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center mx-auto mb-6">
              <AlertCircle className="w-8 h-8 text-orange-600 dark:text-orange-400" />
            </div>
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">
              {t('subscription.yourExpiredTitle')}
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              {t('subscription.yourExpiredMessage')}
            </p>
            <button
              onClick={() => navigate("/")}
              className="btn btn-primary w-full"
            >
              {t('subscription.backToHome')}
            </button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex-1 h-full overflow-hidden hero-gradient flex flex-col relative w-full">
      <main className="flex-1 flex flex-col items-center justify-start px-3 py-4 sm:py-10 md:py-6 lg:py-10 overflow-y-auto w-full">

        {editing ? (
          // EDIT MODE - COMPACT PREMIUM STYLE LIKE VIEW MODE
          <div className="w-full max-w-2xl">
            {/* Premium Header Card */}
            <div className="relative mb-4">
              {/* Background Gradient */}
              <div className="absolute inset-0 bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600 rounded-2xl opacity-90"></div>
              <div className="absolute inset-0 bg-gradient-to-br from-blue-600/20 to-purple-600/20 rounded-2xl backdrop-blur-xl"></div>

              {/* Content */}
              <div className="relative bg-white/10 dark:bg-gray-900/10 backdrop-blur-xl rounded-2xl border border-white/20 dark:border-gray-700/20 shadow-xl overflow-hidden">
                {/* Profile Section */}
                <div className="p-4 sm:p-6 text-center">
                  {/* Avatar with Premium Ring */}
                  <div className="relative inline-block mb-4">
                    <div className="absolute inset-0 bg-gradient-to-r from-yellow-400 to-pink-500 rounded-full animate-pulse"></div>
                    <div className="relative w-24 h-24 sm:w-28 sm:h-28 md:w-32 md:h-32 rounded-full overflow-hidden border-3 border-white shadow-xl bg-gradient-to-br from-blue-500 to-purple-600">
                      {avatarPreview || getAvatarUrl(user) ? (
                        <img
                          src={avatarPreview || getAvatarUrl(user) || ""}
                          alt={`${user.firstName} ${user.lastName}`}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-blue-500 to-purple-600">
                          <User className="w-10 h-10 sm:w-12 sm:h-12 md:w-14 md:h-14 text-white" />
                        </div>
                      )}
                    </div>
                    {/* Avatar Upload Button */}
                    <label className="absolute -bottom-1 -right-1 w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-lg cursor-pointer transition-transform">
                      <Camera className="w-5 h-5 text-gray-600" />
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleAvatarChange}
                        className="hidden"
                      />
                    </label>
                  </div>

                  {/* Name with Premium Styling */}
                  <div className="mb-3">
                    <h2 className="text-2xl sm:text-3xl md:text-4xl font-normal text-white mb-2">
                      {user.firstName} {user.lastName}
                    </h2>
                    <div className="flex items-center justify-center gap-2 text-white/80">
                      <Sparkles className="w-4 h-4" />
                      <span className="text-base font-medium">{t('dashboard.editingProfile')}</span>
                      <Sparkles className="w-4 h-4" />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Form Cards Grid */}
            <div className="space-y-4 mb-6">
              {/* First Name Field */}
              <div className="space-y-2">
                <label className="block text-base font-normal text-gray-600 dark:text-gray-400">
                  {t("dashboard.firstName")}
                </label>
                <input
                  type="text"
                  value={editForm?.firstName || ""}
                  onChange={(e) => setEditForm({ ...editForm!, firstName: e.target.value })}
                  maxLength={20}
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-base"
                  placeholder={t("dashboard.firstNamePlaceholder")}
                />
              </div>

              {/* Last Name Field */}
              <div className="space-y-2">
                <label className="block text-base font-normal text-gray-600 dark:text-gray-400">
                  {t("dashboard.lastName")}
                </label>
                <input
                  type="text"
                  value={editForm?.lastName || ""}
                  onChange={(e) => setEditForm({ ...editForm!, lastName: e.target.value })}
                  maxLength={20}
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-base"
                  placeholder={t("dashboard.lastNamePlaceholder")}
                />
              </div>

              {/* Phone Field */}
              <div className="space-y-2">
                <label className="block text-base font-normal text-gray-600 dark:text-gray-400">
                  {t("dashboard.phone")}
                </label>
                <input
                  type="tel"
                  value={editForm?.phone || ""}
                  onChange={(e) => setEditForm({ ...editForm!, phone: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-base"
                  placeholder={
                    editForm?.phoneCountry === 'RU'
                      ? t('dashboard.phonePlaceholder')
                      : t('dashboard.phonePlaceholder')
                  }
                />
              </div>

              {/* Telegram Field */}
              <div className="space-y-2">
                <label className="block text-base font-normal text-gray-600 dark:text-gray-400">
                  {t("dashboard.telegram")}
                </label>
                <input
                  type="text"
                  value={editForm?.telegram || ""}
                  onChange={(e) => setEditForm({ ...editForm!, telegram: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-base"
                  placeholder="@username"
                />
              </div>
            </div>

            {/* Action Buttons */}
            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={handleSave}
                className="group relative bg-green-600 hover:bg-green-700 text-white rounded-xl p-3 shadow-lg hover:shadow-xl transition-all duration-300 overflow-hidden"
              >
                <div className="relative flex flex-col items-center gap-2">
                  <span className="font-normal text-sm">{t('dashboard.saveChanges')}</span>
                </div>
              </button>

              <button
                onClick={handleCancel}
                className="group relative bg-gray-600 hover:bg-gray-700 text-white rounded-xl p-3 shadow-lg hover:shadow-xl transition-all duration-300 overflow-hidden"
              >
                <div className="relative flex flex-col items-center gap-2">
                  <span className="font-normal text-sm">{t('dashboard.cancel')}</span>
                </div>
              </button>
            </div>
          </div>
        ) : (
          // VIEW MODE - ADVANCED MOBILE APP DESIGN
          <div className="w-full max-w-2xl">
            {/* Premium Header Card */}
            <div className="relative mb-4">
              {/* Background Gradient */}
              <div className="absolute inset-0 bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600 rounded-2xl opacity-90"></div>
              <div className="absolute inset-0 bg-gradient-to-br from-blue-600/20 to-purple-600/20 rounded-2xl backdrop-blur-xl"></div>

              {/* Content */}
              <div className="relative bg-white/10 dark:bg-gray-900/10 backdrop-blur-xl rounded-2xl border border-white/20 dark:border-gray-700/20 shadow-xl overflow-hidden">
                {/* Status Badge */}
                <div className="absolute top-3 right-3 z-10">
                  <div className={`px-2 py-1 rounded-full text-xs font-normal flex items-center gap-1 backdrop-blur-md border ${
                    user.status === "open"
                      ? "bg-green-500/20 text-green-100 border-green-400/30"
                      : "bg-red-500/20 text-red-100 border-red-400/30"
                  }`}>
                    {user.status === "open" ? (
                      <><Unlock className="w-3 h-3" /><span>{t("dashboard.statusOpen")}</span></>
                    ) : (
                      <><Lock className="w-3 h-3" /><span>{t("dashboard.statusClosed")}</span></>
                    )}
                  </div>
                </div>

                {/* Profile Section */}
                <div className="p-4 sm:p-6 text-center">
                  {/* Avatar with Premium Ring */}
                  <div className="relative inline-block mb-4">
                    <div className="absolute inset-0 bg-gradient-to-r from-yellow-400 to-pink-500 rounded-full animate-pulse"></div>
                    <div className="relative w-20 h-20 sm:w-24 sm:h-24 md:w-28 md:h-28 rounded-full overflow-hidden border-3 border-white shadow-xl bg-gradient-to-br from-blue-500 to-purple-600">
                      {avatarPreview || getAvatarUrl(user) ? (
                        <img
                          src={avatarPreview || getAvatarUrl(user) || ""}
                          alt={`${user.firstName} ${user.lastName}`}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-blue-500 to-purple-600">
                          <User className="w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 text-white" />
                        </div>
                      )}
                    </div>
                    {/* Premium Badge */}
                    <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-gradient-to-r from-yellow-400 to-orange-500 rounded-full flex items-center justify-center shadow-lg">
                      <Crown className="w-3 h-3 text-white" />
                    </div>
                  </div>

                  {/* Name with Premium Styling */}
                  <div className="mb-3">
                    <h2 className="text-2xl sm:text-2xl md:text-3xl font-normal text-white mb-1">
                      {user.firstName} {user.lastName}
                    </h2>
                    <div className="flex items-center justify-center gap-1 text-white/70">
                      <Sparkles className="w-3 h-3" />
                      <span className="text-sm font-medium">{t("dashboard.title")}</span>
                      <Sparkles className="w-3 h-3" />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Contact Cards Grid */}
            <div className="space-y-3 mb-4">
              {/* Phone Card */}
              <div className="group relative bg-white dark:bg-gray-800 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 to-purple-500/10 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                <div className="relative p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center shadow-md transition-transform">
                      <Phone className="w-5 h-5 text-white" />
                    </div>
                    <div className="flex-1">
                      <p className="text-2xsm font-medium text-gray-500 dark:text-gray-400 mb-1">{t('dashboard.phone')}</p>
                      <p className="text-base font-normal text-gray-900 dark:text-white">{user.phone}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Telegram Card */}
              <div className="group relative bg-white dark:bg-gray-800 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 to-purple-500/10 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                <div className="relative p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 flex-1">
                      <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center shadow-md transition-transform">
                        <Send className="w-5 h-5 text-white" />
                      </div>
                      <div className="flex-1">
                        <p className="text-2xsm font-medium text-gray-500 dark:text-gray-400 mb-1">{t('dashboard.telegram')}</p>
                        <p className="text-base font-normal text-gray-900 dark:text-white">
                          {user.telegram ? (user.telegram.startsWith('@') ? user.telegram : `@${user.telegram}`) : "@username"}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Status Toggle Card */}
              <div className="group relative bg-white dark:bg-gray-800 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-r from-green-500/10 to-emerald-500/10 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                <div className="relative p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 flex-1">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-md transition-transform ${
                        user.status === "open"
                          ? "bg-gradient-to-br from-green-500 to-emerald-600"
                          : "bg-gradient-to-br from-red-500 to-pink-600"
                      }`}>
                        {user.status === "open" ? (
                          <Unlock className="w-5 h-5 text-white" />
                        ) : (
                          <Lock className="w-5 h-5 text-white" />
                        )}
                      </div>
                      <div className="flex-1">
                        <p className="text-2xsm font-medium text-gray-500 dark:text-gray-400 mb-1">{t('dashboard.status')}</p>
                        <div className="flex items-center gap-2">
                          {user.status === "open" ? (
                            <Unlock className={`w-5 h-5 text-green-600 dark:text-green-400`} />
                          ) : (
                            <Lock className={`w-5 h-5 text-red-600 dark:text-red-400`} />
                          )}
                          <p className={`text-base font-normal ${
                            user.status === "open"
                              ? "text-green-600 dark:text-green-400"
                              : "text-red-600 dark:text-red-400"
                          }`}>
                            {user.status === "open" ? t("dashboard.statusOpen") : t("dashboard.statusClosed")}
                          </p>
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={toggleStatus}
                      className="px-3 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-normal transition-all shadow-md hover:shadow-lg text-2xsm flex items-center justify-center"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Premium Action Buttons */}
            <div className="grid grid-cols-3 gap-3">
              <button
                onClick={installPWA}
                className="group relative bg-green-600 hover:bg-green-700 text-white rounded-xl p-3 shadow-lg hover:shadow-xl transition-all duration-300 overflow-hidden"
              >
                <div className="relative flex flex-col items-center gap-2">
                  <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
                    <Download className="w-6 h-6 text-white" />
                  </div>
                </div>
              </button>

              <button
                onClick={handleEdit}
                className="group relative bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl p-3 shadow-lg hover:shadow-xl transition-all duration-300 overflow-hidden"
              >
                <div className="relative flex flex-col items-center gap-2">
                  <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
                    <Settings className="w-6 h-6 text-white" />
                  </div>
                </div>
              </button>


              <button
                onClick={() => navigate(`/user/${user.id}/notifications`)}
                className="group relative bg-purple-600 hover:bg-purple-700 text-white rounded-xl p-3 shadow-lg hover:shadow-xl transition-all duration-300 overflow-hidden"
              >
                <div className="relative flex flex-col items-center gap-2">
                  <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
                    <Bell className="w-6 h-6 text-white" />
                    {hasNewNotifications && (
                      <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
                    )}
                  </div>
                </div>
              </button>
            </div>
          </div>
        )}
      </main>

      {/* Telegram Modal */}
      {showTelegramModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="feature-card max-w-md w-full">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl sm:text-2xl font-normal text-gray-900 dark:text-white">
                {t("dashboard.addTelegram")}
              </h3>
              <button
                onClick={() => setShowTelegramModal(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <input
              type="text"
              placeholder={t("dashboard.telegramPlaceholder")}
              value={telegramInput}
              onChange={(e) => setTelegramInput(e.target.value)}
              maxLength={20}
              className="input mb-6"
              autoFocus
            />

            <div className="flex gap-4">
              <button
                onClick={handleTelegramAdd}
                className="btn btn-primary flex-1"
              >
                {t("common.save")}
              </button>
              <button
                onClick={() => {
                  setShowTelegramModal(false);
                  setTelegramInput("");
                }}
                className="btn btn-secondary flex-1"
              >
                {t("common.cancel")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Push Notification Prompt */}
      <PushNotificationPrompt />
    </div>
  );
}
