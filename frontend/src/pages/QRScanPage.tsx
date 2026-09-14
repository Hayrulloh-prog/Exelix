import { useState, useEffect, useRef } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import toast from "react-hot-toast";
import { API_ENDPOINTS } from "../lib/api";
import UserDataSync from "../lib/userDataSync";
import i18n from "i18next";
import {
  Shield,
  QrCode,
  CheckCircle,
  AlertCircle,
  Loader2,
  User,
  Camera,
  MessageCircle,
  Send,
} from "lucide-react";

interface QRValidationResponse {
  success: boolean;
  valid: boolean;
  canRegister: boolean;
  userExists: boolean;
  isOwner?: boolean;
  token?: string; // JWT token for authentication
  userData?: {
    id: string;
    firstName: string;
    lastName: string;
    phone: string;
    status: "open" | "closed";
    language?: string;
    avatarUrl?: string;
    telegramUsername?: string;
    telegram?: string;
  };
  message?: string;
}

export function QRScanPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { token } = useParams();
  const [searchParams] = useSearchParams();
  const qrToken = token || searchParams.get("token");

  const [loading, setLoading] = useState(true);

  const [validation, setValidation] = useState<QRValidationResponse | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [hasValidated, setHasValidated] = useState(false);

  // Redirect existing user to dashboard or notification page
  useEffect(() => {
    if (validation) {
      if (validation.userExists) {
        if (validation.isOwner) {
          // Save user data locally
          if (validation.userData) {
            const userData = {
              id: validation.userData.id,
              firstName: validation.userData.firstName,
              lastName: validation.userData.lastName,
              phone: validation.userData.phone,
              status: validation.userData.status,
              language: validation.userData.language || 'ru',
              avatarUrl: validation.userData.avatarUrl,
              telegramUsername: validation.userData.telegramUsername,
            };
            UserDataSync.save(userData);
          }

          // Set JWT authentication tokens
          if (validation.token) {
            localStorage.setItem("token", validation.token);
            localStorage.setItem("userToken", validation.token);
          }

          navigate("/dashboard");
        } else {
          // Stranger scanned: redirect to notify page
          navigate(`/notify/${qrToken}`);
        }
      }
    }
  }, [validation, navigate, qrToken]);

  useEffect(() => {
    if (!qrToken) {
      setError(t('errors.qrNotFound'));
      setLoading(false);
      return;
    }

    const validateQR = async () => {
      try {

        // Получаем текущий язык из i18next
        const currentLanguage = i18n.language || 'ru';

        // Получаем JWT токен из local storage, если он есть
        const userToken = localStorage.getItem("token") || localStorage.getItem("userToken");
        const headers: Record<string, string> = {
          "Content-Type": "application/json",
          "Accept-Language": currentLanguage,
        };
        if (userToken) {
          headers["Authorization"] = `Bearer ${userToken}`;
        }

        const response = await fetch(API_ENDPOINTS.VALIDATE_QR(qrToken), {
          method: "GET",
          headers,
        });

        const data = await response.json();

        if (data.success) {
          setValidation(data);
        } else {
          setError(data.error ? t(`errors.${data.error}`) : t('errors.invalidToken'));
        }
      } catch (err) {
        setError(t('errors.qrValidationFailed'));
      } finally {
        setLoading(false);
        setHasValidated(true);
      }
    };

    if (!hasValidated) {
      validateQR();
    }
  }, [qrToken]);

  if (loading) {
    return (
      <div className="flex-1 hero-gradient flex items-center justify-center">
        <main className="container mx-auto px-4 sm:px-6 py-8 sm:py-10">
          <div className="flex items-center justify-center min-h-[60vh]">
            <div className="text-center">
              <div className="w-16 h-16 sm:w-20 sm:h-20 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl sm:rounded-3xl flex items-center justify-center mx-auto mb-6 sm:mb-8 shadow-xl">
                <QrCode className="w-8 h-8 sm:w-10 sm:h-10 text-white animate-pulse" />
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mb-3 sm:mb-4">
                Проверка QR кода
              </h1>
              <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 mb-6 sm:mb-8">
                Подождите, мы проверяем ваш QR код...
              </p>
              <div className="w-12 h-12 sm:w-16 sm:h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
            </div>
          </div>
        </main>
      </div>
    );
  }

  if (error) {
    // If the token is invalid (i.e. not registered in system at all) or database check reports INVALID_TOKEN
    const isInvalidToken = error === t('errors.INVALID_TOKEN') || error === t('errors.invalidToken') || error.toLowerCase().includes('token');

    return (
      <div className="fixed inset-0 w-screen h-screen overflow-hidden hero-gradient flex items-center justify-center">
        <main className="container mx-auto px-4 sm:px-6 py-4 flex items-center justify-center w-full">
          <div className="w-full max-w-md">
            <div className="feature-card text-center px-4 sm:px-6 py-6 sm:py-8 shadow-xl">
              <div className="w-16 h-16 sm:w-20 sm:h-20 bg-gradient-to-br from-red-500 to-red-600 rounded-2xl sm:rounded-3xl flex items-center justify-center mx-auto mb-6 sm:mb-8 shadow-xl">
                <AlertCircle className="w-8 h-8 sm:w-10 sm:h-10 text-white" />
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mb-3 sm:mb-4">
                {isInvalidToken ? t('errors.invalidToken') : t('errors.serverError')}
              </h1>
              <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 mb-6 sm:mb-8 px-2">
                {isInvalidToken ? t('errors.INVALID_QR_CODE') : error}
              </p>
              <button
                onClick={() => navigate("/")}
                className="btn btn-secondary w-full text-sm sm:text-base py-2.5 sm:py-3"
              >
                {t("registration.backToHome")}
              </button>
            </div>
          </div>
        </main>
      </div>
    );
  }

  // User exists and scanner is the owner - show user data / dashboard redirect button
  if (validation?.userExists && validation?.isOwner && validation?.userData) {
    // Save user data locally
    const userData = {
      id: validation.userData.id,
      firstName: validation.userData.firstName,
      lastName: validation.userData.lastName,
      phone: validation.userData.phone,
      status: validation.userData.status,
      language: validation.userData.language || 'ru',
      avatarUrl: validation.userData.avatarUrl,
      telegramUsername: validation.userData.telegramUsername,
    };

    UserDataSync.save(userData);

    // Set JWT authentication token AFTER UserDataSync.save() to prevent it from being cleared
    if (validation.token) {
      localStorage.setItem("token", validation.token);
      localStorage.setItem("userToken", validation.token);
    }

    // Show user data instead of redirecting
    return (
      <div className="flex-1 overflow-y-auto hero-gradient flex flex-col justify-center py-6">
        <main className="container mx-auto px-4 sm:px-6 py-8 sm:py-10">
          <div className="flex items-center justify-center min-h-[60vh]">
            <div className="w-full max-w-md">
              <div className="feature-card text-center px-4 sm:px-6 py-6 sm:py-8">
                <div className="w-16 h-16 sm:w-20 sm:h-20 bg-gradient-to-br from-green-500 to-green-600 rounded-2xl sm:rounded-3xl flex items-center justify-center mx-auto mb-6 sm:mb-8 shadow-xl">
                  <CheckCircle className="w-8 h-8 sm:w-10 sm:h-10 text-white" />
                </div>
                <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mb-3 sm:mb-4">
                  {t('errors.QR_ALREADY_REGISTERED')}
                </h1>
                <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 mb-6 sm:mb-8 px-2">
                  {t('registration.welcome')}, {validation.userData.firstName}!
                </p>
                <button
                  onClick={() => navigate("/dashboard")}
                  className="btn btn-primary w-full text-sm sm:text-base py-2.5 sm:py-3"
                >
                  {t('registration.toDashboard')}
                </button>
              </div>
            </div>
          </div>
        </main>
      </div>
    );
  }

  if (!validation) {
    return (
      <div className="flex-1 hero-gradient flex items-center justify-center">
        <main className="container mx-auto px-4 sm:px-6 py-8 sm:py-10">
          <div className="flex items-center justify-center min-h-[60vh]">
            <div className="text-center">
              <div className="w-16 h-16 sm:w-20 sm:h-20 bg-gradient-to-br from-red-500 to-red-600 rounded-2xl sm:rounded-3xl flex items-center justify-center mx-auto mb-6 sm:mb-8 shadow-xl">
                <AlertCircle className="w-8 h-8 sm:w-10 sm:h-10 text-white" />
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mb-3 sm:mb-4">
                {t('errors.qrValidationFailed')}
              </h1>
              <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 mb-6 sm:mb-8">
                {t('errors.invalidToken')}
              </p>
              <button
                onClick={() => navigate("/")}
                className="btn btn-primary w-full text-sm sm:text-base py-2.5 sm:py-3"
              >
                {t('registration.backToHome')}
              </button>
            </div>
          </div>
        </main>
      </div>
    );
  }

  if (!validation.valid) {
    return (
      <div className="fixed inset-0 w-screen h-screen overflow-hidden hero-gradient flex items-center justify-center">
        <main className="container mx-auto px-4 sm:px-6 py-4 flex items-center justify-center w-full">
          <div className="w-full max-w-md">
            <div className="feature-card text-center px-4 sm:px-6 py-6 sm:py-8 shadow-xl">
              <div className="w-16 h-16 sm:w-20 sm:h-20 bg-gradient-to-br from-orange-500 to-orange-600 rounded-2xl sm:rounded-3xl flex items-center justify-center mx-auto mb-6 sm:mb-8 shadow-xl">
                <QrCode className="w-8 h-8 sm:w-10 sm:h-10 text-white" />
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mb-3 sm:mb-4">
                {t('errors.invalidToken')}
              </h1>
              <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 mb-6 sm:mb-8 px-2">
                {t('errors.qrUsed')}
              </p>
              <button
                onClick={() => navigate("/")}
                className="btn btn-primary w-full text-sm sm:text-base py-2.5 sm:py-3"
              >
                {t('registration.backToHome')}
              </button>
            </div>
          </div>
        </main>
      </div>
    );
  }

  if (validation.canRegister) {
    const googleId = searchParams.get('googleId');
    const googleEmail = searchParams.get('email');
    const googleFirstName = searchParams.get('firstName');
    const googleLastName = searchParams.get('lastName');
    const googleAvatarUrl = searchParams.get('avatarUrl');

    if (!googleId) {
      // Step 1: Connect Google Account
      return (
        <div className="flex-1 overflow-y-auto hero-gradient flex items-center justify-center py-6">
          <main className="container mx-auto px-4 sm:px-6">
            <div className="max-w-md mx-auto">
              <div className="bg-white dark:bg-gray-800 shadow-2xl rounded-2xl border border-gray-100 dark:border-gray-700 text-center px-4 py-6 sm:px-8 sm:py-10">
                <div className="w-16 h-16 sm:w-20 sm:h-20 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl sm:rounded-3xl flex items-center justify-center mx-auto mb-6 sm:mb-8 shadow-xl">
                  <Shield className="w-8 h-8 sm:w-10 sm:h-10 text-white" />
                </div>
                <h2 className="text-xl sm:text-2xl font-bold mb-4 text-gray-900 dark:text-white">
                  {t("registration.connectGoogleTitle", "Сначала привяжите Google аккаунт")}
                </h2>
                <p className="mb-8 text-sm sm:text-base text-gray-600 dark:text-gray-400">
                  {t("registration.connectGoogleDesc", "Для завершения регистрации и создания личного кабинета необходимо авторизоваться через Google.")}
                </p>
                <button
                  onClick={() => {
                    const apiUrl = import.meta.env.VITE_API_URL || "/api";
                    const backendUrl = apiUrl.startsWith("http")
                      ? apiUrl
                      : `${window.location.origin}${apiUrl}`;
                    window.location.assign(`${backendUrl}/v1/auth/google?qrToken=${qrToken}`);
                  }}
                  className="w-full flex justify-center items-center gap-3 px-4 py-3.5 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 text-gray-700 dark:text-white font-semibold shadow-sm transition-all duration-200 transform hover:-translate-y-0.5"
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                  </svg>
                  {t("registration.signUpGoogle")}
                </button>
              </div>
            </div>
          </main>
        </div>
      );
    }

    // Show registration form
    return (
      <div className="flex-1 h-full overflow-y-auto w-full hero-gradient">
        <main className="container mx-auto px-4 sm:px-6 py-8 sm:py-10">
          <div className="max-w-2xl mx-auto">
            <div className="text-center mb-8 sm:mb-10">
              <div className="w-16 h-16 sm:w-24 sm:h-24 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl sm:rounded-3xl flex items-center justify-center mx-auto mb-4 sm:mb-8 shadow-xl">
                <QrCode className="w-8 h-8 sm:w-12 sm:h-12 text-white" />
              </div>
              <h1 className="text-2xl sm:text-4xl font-bold text-gray-900 dark:text-white mb-3 sm:mb-4 px-4">
                {t('registration.title')}
              </h1>
              <div className="flex items-center justify-center gap-2 mb-6 sm:mb-8">
                <Shield className="w-4 h-4 sm:w-5 sm:h-5 text-green-600" />
                <span className="text-sm sm:text-base text-green-600 dark:text-green-400 font-medium">
                  {t('registration.qrVerified')}
                </span>
              </div>
            </div>

            <RegistrationForm
              qrToken={qrToken!}
              googleData={{
                googleId,
                email: googleEmail,
                firstName: googleFirstName,
                lastName: googleLastName,
                avatarUrl: googleAvatarUrl
              }}
            />
          </div>
        </main>
      </div>
    );
  }

  // Default fallback - should not reach here but just in case
  return (
    <div className="flex-1 overflow-y-auto hero-gradient flex flex-col justify-center py-6">
      <main className="container mx-auto px-4 sm:px-6 py-8 sm:py-10">
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center">
            <div className="w-16 h-16 sm:w-20 sm:h-20 bg-gradient-to-br from-orange-500 to-orange-600 rounded-2xl sm:rounded-3xl flex items-center justify-center mx-auto mb-6 sm:mb-8 shadow-xl">
              <AlertCircle className="w-8 h-8 sm:w-10 sm:h-10 text-white" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mb-3 sm:mb-4">
              {t('errors.unknownError')}
            </h1>
            <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 mb-6 sm:mb-8">
              {t('errors.unknownError')}
            </p>
            <button
              onClick={() => navigate("/")}
              className="btn btn-primary w-full text-sm sm:text-base py-2.5 sm:py-3"
            >
              {t('registration.backToHome')}
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
export function RegistrationForm({ qrToken, googleData }: { qrToken: string, googleData: any }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [phoneValidationError, setPhoneValidationError] = useState<string>('');
  const [formData, setFormData] = useState({
    firstName: googleData.firstName || '',
    lastName: googleData.lastName || '',
    phone: '',
    phoneCountry: "RU",
    telegramUsername: '',
    status: "closed" as "open" | "closed",
    language: "ru" as "ru" | "ky" | "en",
    avatarFile: null as File | null,
  });

  const hasShownToast = useRef(false);

  useEffect(() => {
    if ((googleData.firstName || googleData.lastName) && !hasShownToast.current) {
      toast.success(t("registration.googleDataLoaded", "Данные Google загружены!"), { id: "googleDataLoaded" });
      hasShownToast.current = true;
    }
  }, [googleData, t]);

  const handleNext = () => {
    if (step === 1) {
      setStep(2);
    }
  };

  const handleBack = () => {
    if (step === 2) {
      setStep(1);
    }
  };

  // Умная функция для добавления кода страны
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

  // Функция для определения страны по номеру телефона
  const detectPhoneCountry = (phone: string): string => {
    let cleanPhone = phone.replace(/\D/g, '');

    console.log('🔍 detectPhoneCountry debug:', {
      original: phone,
      cleanPhone: cleanPhone,
      length: cleanPhone.length
    });

    // Проверяем длину и начинаем анализ
    if (cleanPhone.length < 7) {
      return 'UNKNOWN';
    }

    // Особый случай для кыргызских номеров, начинающихся с 0
    if (cleanPhone.startsWith('0') && (cleanPhone.length === 9 || cleanPhone.length === 10)) {
      // 0XX XXX XXX или 0XXX XXX XXX -> это Кыргызстан
      return 'KG';
    }

    // Российские номера (10-11 цифр)
    if (
      (cleanPhone.length === 10 && cleanPhone.startsWith('9')) || // 9XX XXX XX XX
      (cleanPhone.length === 10 && cleanPhone.startsWith('8')) || // 8XXX XXX XX XX
      (cleanPhone.length === 11 && cleanPhone.startsWith('7')) || // 7XXX XXX XX XX
      (phone.startsWith('+7') && cleanPhone.length === 11) // +7XXX XXX XX XX
    ) {
      console.log('✅ Detected RU (standard patterns)');
      return 'RU';
    }

    // Дополнительная проверка для любых российских номеров +7XXXXXXXXXX
    if (phone.startsWith('+7') && cleanPhone.length === 11) {
      console.log('✅ Detected RU (+7 any digits)');
      return 'RU';
    }

    // Проверка для российских номеров без плюса
    if (cleanPhone.length === 11 && cleanPhone.startsWith('7')) {
      console.log('✅ Detected RU (7XXXXXXXXXX)');
      return 'RU';
    }

    // Кыргызские номера (9-12 цифр)
    if (
      (cleanPhone.length === 9 && cleanPhone.startsWith('9')) || // 9XX XXX XXX
      (cleanPhone.length === 9 && cleanPhone.startsWith('4')) || // 4XX XXX XXX
      (cleanPhone.length === 9 && cleanPhone.startsWith('3')) || // 3XX XXX XXX
      (cleanPhone.length === 9 && cleanPhone.startsWith('2')) || // 2XX XXX XXX
      (cleanPhone.length === 9 && cleanPhone.startsWith('5')) || // 5XX XXX XXX (новый код)
      (cleanPhone.length === 9 && cleanPhone.startsWith('0')) || // 0XX XXX XXX
      (cleanPhone.length === 10 && cleanPhone.startsWith('5')) || // 5XXX XXX XXX (10 цифр)
      (cleanPhone.length === 10 && cleanPhone.startsWith('0')) || // 0XXX XXX XXX (10 цифр)
      (phone.startsWith('+996') && cleanPhone.length === 12) // +996XXX XXX XX
    ) {
      return 'KG';
    }

    // Дополнительные проверки для 9-значных номеров
    if (cleanPhone.length === 9) {
      // Если начинается с 0, это скорее всего Кыргызстан
      if (cleanPhone.startsWith('0')) {
        return 'KG';
      }
    } else {
      return 'KG';
    }
    return 'UNKNOWN';
  };

  const kgCountry = 'KG';
  const ruCountry = 'RU';
  const unknownCountry = 'UNKNOWN';

  // Функция для валидации соответствия страны и номера
  const validatePhoneCountry = (phone: string, selectedCountry: string): { isValid: boolean; message: string } => {
    const detectedCountry = detectPhoneCountry(phone);

    // Разрешаем номера, которые начинаются с 0 или +996 для Кыргызстана
    // и любые российские номера
    if (detectedCountry === unknownCountry) {
      // Проверяем специально кыргызские номера
      if (phone.startsWith('0') || phone.startsWith('+996')) {
        return { isValid: true, message: '' };
      }
      // Проверяем любые российские номера
      if (phone.startsWith('7') || phone.startsWith('8') || phone.startsWith('+7')) {
        return { isValid: true, message: '' };
      }
      return {
        isValid: false,
        message: t('errors.validationError')
      };
    }

    // Если пользователь выбрал Россию и номер начинается с +7, считаем валидным
    if (selectedCountry === ruCountry && phone.startsWith('+7') && phone.replace(/\D/g, '').length === 11) {
      return { isValid: true, message: '' };
    }

    if (selectedCountry === kgCountry && detectedCountry !== kgCountry && detectedCountry !== unknownCountry) {
      return {
        isValid: false,
        message: t('errors.phoneCountryMismatch', { selectedCountry: t('admin.kyrgyzstan') })
      };
    }

    if (selectedCountry === ruCountry && detectedCountry !== ruCountry && detectedCountry !== unknownCountry) {
      return {
        isValid: false,
        message: t('errors.phoneCountryMismatch', { selectedCountry: t('admin.russia') })
      };
    }

    return {
      isValid: true,
      message: ''
    };
  };

  const handleSubmit = async () => {
    if (loading) return;

    setLoading(true);

    try {
      // Дополнительная проверка токена перед регистрацией
      const tokenCheck = await fetch(API_ENDPOINTS.CHECK_QR_TOKEN(qrToken), {
        headers: {
          "Accept-Language": i18n.language || 'ru',
        },
      });
      const tokenData = await tokenCheck.json();

      if (!tokenData.success || !tokenData.canRegister || tokenData.userExists) {
        toast.error('QR-код недействителен или уже использован. Пожалуйста, используйте новый QR-код.');
        setLoading(false);
        return;
      }

      let avatarBase64 = "";
      if (formData.avatarFile) {
        avatarBase64 = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(formData.avatarFile!);
        });
      }

      const formattedPhone = formatPhoneNumber(formData.phone);

      // Валидация соответствия страны и номера телефона
      const phoneValidation = validatePhoneCountry(formData.phone, formData.phoneCountry);
      if (!phoneValidation.isValid) {
        toast.error(phoneValidation.message);
        setLoading(false);
        return;
      }

      console.log("📤 Отправка данных регистрации:", {
        token: qrToken,
        firstName: formData.firstName,
        lastName: formData.lastName,
        phone: formattedPhone,
        phoneCountry: formData.phoneCountry,
        telegram: formData.telegramUsername,
        hasAvatar: !!avatarBase64,
        avatarLength: avatarBase64 ? avatarBase64.length : 0,
        status: formData.status,
        language: formData.language,
        detectedCountry: detectPhoneCountry(formData.phone),
      });

      const response = await fetch(API_ENDPOINTS.QR_REGISTER, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept-Language": i18n.language || 'ru',
        },
        body: JSON.stringify({
          token: qrToken,
          firstName: formData.firstName,
          lastName: formData.lastName,
          phone: formattedPhone,
          phoneCountry: formData.phoneCountry,
          telegram: formData.telegramUsername,
          status: formData.status,
          language: formData.language,
          avatar: avatarBase64 || googleData.avatarUrl,
          email: googleData.email,
          googleId: googleData.googleId,
        })
      });

      const data = await response.json();

      if (data.success) {
        // Save user data locally
        const userData = {
          id: data.user.id,
          firstName: data.user.firstName,
          lastName: data.user.lastName,
          phone: data.user.phone,
          status: data.user.status,
          language: data.user.language,
          avatarUrl: data.user.avatarUrl,
          telegramUsername: data.user.telegramUsername,
        };

        UserDataSync.save(userData);

        // Set JWT authentication token AFTER UserDataSync.save() to prevent it from being cleared
        if (data.token) {
          localStorage.setItem("token", data.token);
          localStorage.setItem("userToken", data.token);
        }

        toast.success(t('registration.registrationSuccess'));

        {/* Info Block - Owner Informed */}
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
              <span className="text-green-800 dark:text-green-200 text-sm font-medium">
                Владелец уже информирован о ситуации
              </span>
            </div>
            <a
              href={`/notify/?token=${qrToken}`}
              className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            >
              Позвонить
            </a>
          </div>
        </div>
        navigate('/dashboard');
      } else if (data.warning === 'PHONE_EXISTS') {
        // Показываем предупреждение о существующем номере
        toast(data.message, {
          icon: '⚠️',
          style: {
            background: 'linear-gradient(to right, #fef3c7, #fed7aa)',
            border: '1px solid #fbbf24',
            color: '#92400e',
          },
        });

        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 mb-6">
          <div className="flex items-center space-x-2">
            <AlertCircle className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
            <span className="text-yellow-800 dark:text-yellow-200 text-sm font-medium">
              {data.message}
            </span>
          </div>
          {data.existingUser && (
            <div className="mt-3 p-3 bg-yellow-100 dark:bg-yellow-800/50 rounded border border-yellow-300 dark:border-yellow-700">
              <p className="text-sm text-yellow-800 dark:text-yellow-200">
                <strong>{t('common.existingUserFound')}</strong><br />
                {t('common.userId')} {data.existingUser.id}<br />
                {t('common.userPhone')} {data.existingUser.phone} ({data.existingUser.phone_country})
              </p>
            </div>
          )}
        </div>
      } else if (data.warning === 'TELEGRAM_EXISTS') {
        // Показываем предупреждение о существующем никнейме Telegram
        toast(data.message, {
          icon: '⚠️',
          style: {
            background: 'linear-gradient(to right, #fef3c7, #fed7aa)',
            border: '1px solid #fbbf24',
            color: '#92400e',
          },
        });

        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 mb-6">
          <div className="flex items-center space-x-2">
            <AlertCircle className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
            <span className="text-yellow-800 dark:text-yellow-200 text-sm font-medium">
              {data.message}
            </span>
          </div>
          {data.existingUser && (
            <div className="mt-3 p-3 bg-yellow-100 dark:bg-yellow-800/50 rounded border border-yellow-300 dark:border-yellow-700">
              <p className="text-sm text-yellow-800 dark:text-yellow-200">
                <strong>{t('common.existingUserFound')}</strong><br />
                {t('common.userId')} {data.existingUser.id}<br />
                {t('common.userTelegram')} @{data.existingUser.telegram_username}
              </p>
            </div>
          )}
        </div>
      } else {
        toast.error(data.message || t('registration.registrationError'));
      }
    } catch (error) {
      console.error('Registration error:', error);
      toast.error(t('registration.registrationError'));
    } finally {
      setLoading(false);
    }
  };

  if (step === 1) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-2xl sm:rounded-3xl shadow-xl sm:shadow-2xl p-4 sm:p-8 border border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-3 mb-6 sm:mb-8">
          <div className="w-8 h-8 sm:w-10 sm:h-10 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold text-sm sm:text-base">
            1
          </div>
          <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
            {t('registration.step1')}
          </h2>
        </div>

        <div className="space-y-4 sm:space-y-6">
          <div>
            <label className="block text-xs sm:text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5 sm:mb-2">
              {t('registration.firstName')} *
            </label>
            <input
              type="text"
              value={formData.firstName}
              onChange={(e) =>
                setFormData({ ...formData, firstName: e.target.value })
              }
              maxLength={20}
              className="w-full px-3 sm:px-4 py-2.5 sm:py-3 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700/50 dark:text-white backdrop-blur-sm text-sm sm:text-base"
              placeholder={t('registration.firstNamePlaceholder')}
            />
          </div>

          <div>
            <label className="block text-xs sm:text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5 sm:mb-2">
              {t('registration.lastName')} *
            </label>
            <input
              type="text"
              value={formData.lastName}
              onChange={(e) =>
                setFormData({ ...formData, lastName: e.target.value })
              }
              maxLength={20}
              className="w-full px-3 sm:px-4 py-2.5 sm:py-3 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700/50 dark:text-white backdrop-blur-sm text-sm sm:text-base"
              placeholder={t('registration.lastNamePlaceholder')}
            />
          </div>

          <div>
            <label className="block text-xs sm:text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5 sm:mb-2">
              {t('registration.phone')} *
            </label>
            <div className="relative">
              <div className="flex gap-2 sm:gap-3">
                <select
                  value={formData.phoneCountry}
                  onChange={(e) => {
                  const newCountry = e.target.value;
                  setFormData({ ...formData, phoneCountry: newCountry });

                  // Валидация при изменении страны
                  if (formData.phone.length >= 3) {
                    const validation = validatePhoneCountry(formData.phone, newCountry);
                    setPhoneValidationError(validation.isValid ? '' : validation.message);
                  }
                }}
                  className="px-2.5 sm:px-4 py-2.5 sm:py-3 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700/50 dark:text-white backdrop-blur-sm text-xs sm:text-sm max-w-[80px] sm:max-w-[120px]"
              >
                  <option value="KG">🇰🇬</option>
                  <option value="RU">🇷🇺</option>
                </select>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => {
                    const newPhone = e.target.value;
                    setFormData({ ...formData, phone: newPhone });

                    // Валидация в реальном времени
                    if (newPhone.length >= 3) {
                    const validation = validatePhoneCountry(newPhone, formData.phoneCountry);
                    setPhoneValidationError(validation.isValid ? '' : validation.message);
                  } else {
                    setPhoneValidationError('');
                  }
                  }}
                  className={`flex-1 px-3 sm:px-4 py-2.5 sm:py-3 border rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700/50 dark:text-white backdrop-blur-sm text-sm sm:text-base ${
                  phoneValidationError
                    ? 'border-red-300 dark:border-red-600'
                    : 'border-gray-200 dark:border-gray-600'
                }`}
                  placeholder={
                    formData.phoneCountry === 'RU'
                      ? t('registration.phonePlaceholderRU')
                      : t('registration.phonePlaceholderKG')
                  }
                />
              </div>
            </div>
          </div>

          <div className="mt-3 sm:mt-4">
            <label className="block text-xs sm:text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5 sm:mb-2">
              {t('registration.telegram')} ({t('registration.optional')})
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 sm:pl-4 flex items-center pointer-events-none z-10">
                <Send className="w-4 h-4 sm:w-5 sm:h-5 text-blue-500 flex-shrink-0" />
              </div>
              <input
                type="text"
                value={formData.telegramUsername}
                onChange={(e) =>
                  setFormData({ ...formData, telegramUsername: e.target.value })
                }
                maxLength={20}
                className="w-full pl-10 sm:pl-12 pr-3 sm:pr-4 py-2.5 sm:py-3 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700/50 dark:text-white backdrop-blur-sm text-sm sm:text-base"
                placeholder={t('registration.telegramPlaceholder')}
              />
            </div>
          </div>

          <div className="mt-3 sm:mt-4">
            <label className="block text-xs sm:text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5 sm:mb-2">
              {t('registration.avatar')} ({t('registration.optional')})
            </label>
            <div className="relative">
              <input
                type="file"
                accept="image/*"
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    avatarFile: e.target.files?.[0] || null,
                  })
                }
                className="hidden"
                id="avatar-file-input"
              />
              <label
                htmlFor="avatar-file-input"
                className="flex items-center justify-center w-full px-4 py-8 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl cursor-pointer hover:border-blue-400 dark:hover:border-blue-500 transition-colors bg-gray-50 dark:bg-gray-700/30 hover:bg-blue-50 dark:hover:bg-blue-900/20 group"
              >
                <div className="text-center">
                  <Camera className="w-8 h-8 sm:w-10 sm:h-10 mx-auto mb-3 text-gray-400 group-hover:text-blue-500 transition-colors" />
                  <span className="text-sm sm:text-base text-gray-600 dark:text-gray-400 group-hover:text-blue-600 dark:group-hover:text-blue-400 font-medium">
                    {formData.avatarFile
                      ? t('registration.fileSelected')
                      : t('registration.filePlaceholder')
                    }
                  </span>
                  {formData.avatarFile && (
                    <div className="mt-2 text-xs sm:text-sm text-green-600 dark:text-green-400 font-medium">
                      {formData.avatarFile.name}
                    </div>
                  )}
                </div>
              </label>
            </div>
          </div>
        </div>

        <div className="flex justify-end mt-6 sm:mt-8">
          <button
            onClick={handleNext}
            disabled={
              loading ||
              !formData.firstName ||
              !formData.lastName ||
              !formData.phone
            }
            className="px-4 sm:px-6 py-2.5 sm:py-3 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-xl hover:from-blue-600 hover:to-purple-700 transition-all duration-200 font-medium shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex items-center gap-2 sm:gap-3 text-sm sm:text-base"
          >
            {t('registration.next')}
            <Camera className="w-3 h-3 sm:w-5 sm:h-5" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mb-4 bg-white dark:bg-gray-800 rounded-2xl sm:rounded-3xl shadow-xl sm:shadow-2xl p-4  border border-gray-200 dark:border-gray-700">
      <div className="flex items-center gap-3 mb-6 sm:mb-8">
        <div className="w-8 h-8 sm:w-10 sm:h-10 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold text-sm sm:text-base">
          2
        </div>
        <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
          {t('registration.step2')}
        </h2>
      </div>

      <div className="space-y-6 sm:space-y-8">
        <div>
          <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 sm:mb-4">
            {t('registration.selectStatus')}
          </label>
          <div className="grid grid-cols-1 gap-4 sm:gap-6">
            <button
              onClick={() => setFormData({ ...formData, status: "closed" })}
              className={`p-4 sm:p-6 rounded-xl sm:rounded-2xl border-2 transition-all text-left ${
                formData.status === "closed"
                  ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20 shadow-lg"
                  : "border-gray-200 dark:border-gray-700 hover:border-gray-300"
              }`}
            >
              <div className="flex items-center gap-3 sm:gap-4 mb-2 sm:mb-3">
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-gray-400 to-gray-600 rounded-lg sm:rounded-xl flex items-center justify-center">
                  <Shield className="w-4 h-4 sm:w-6 sm:h-6 text-white" />
                </div>
                <div className="flex-1">
                  <div className="font-bold text-gray-900 dark:text-white text-sm sm:text-base">
                    {t('registration.statusClosed')}
                  </div>
                  <div className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 flex items-center gap-2">
                    {t('registration.statusDescription.closed')}
                    <MessageCircle className="w-7 h-7 sm:w-5 sm:h-5 text-gray-400" />
                  </div>
                </div>
              </div>
              {formData.status === "closed" && (
                <div className="w-5 h-5 sm:w-6 sm:h-6 bg-blue-600 rounded-full flex items-center justify-center">
                  <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-white rounded-full"></div>
                </div>
              )}
            </button>

            <button
              onClick={() => setFormData({ ...formData, status: "open" })}
              className={`p-4 sm:p-6 rounded-xl sm:rounded-2xl border-2 transition-all text-left ${
                formData.status === "open"
                  ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20 shadow-lg"
                  : "border-gray-200 dark:border-gray-700 hover:border-gray-300"
              }`}
            >
              <div className="flex items-center gap-3 sm:gap-4 mb-2 sm:mb-3">
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-green-400 to-green-600 rounded-lg sm:rounded-xl flex items-center justify-center">
                  <User className="w-4 h-4 sm:w-6 sm:h-6 text-white" />
                </div>
                <div className="flex-1">
                  <div className="font-bold text-gray-900 dark:text-white text-sm sm:text-base">
                    {t('registration.statusOpen')}
                  </div>
                  <div className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 flex items-center gap-2">
                    {t('registration.statusDescription.open')}
                    <MessageCircle className="w-7 h-7 sm:w-5 sm:h-5 text-blue-500" />
                  </div>
                </div>
              </div>
              {formData.status === "open" && (
                <div className="w-5 h-5 sm:w-6 sm:h-6 bg-blue-600 rounded-full flex items-center justify-center">
                  <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-white rounded-full"></div>
                </div>
              )}
            </button>
          </div>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row justify-between gap-3 sm:gap-0 mt-6 sm:mt-8">
        <button
          onClick={handleBack}
          className="w-full sm:w-auto px-4 sm:px-6 py-2.5 sm:py-3 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl hover:bg-gray-200 dark:hover:bg-gray-600 transition-all duration-200 font-medium text-sm sm:text-base order-2 sm:order-1"
        >
          {t('registration.back')}
        </button>
        <button
          onClick={handleSubmit}
          disabled={loading}
          className="w-full sm:w-auto px-4 sm:px-6 py-2.5 sm:py-3 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-xl hover:from-blue-600 hover:to-purple-700 transition-all duration-200 font-medium shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center gap-2 sm:gap-3 text-sm sm:text-base order-1 sm:order-2"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 sm:w-5 sm:h-5 animate-spin" />
              {t('registration.registering')}
            </>
          ) : (
            <>
              <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5" />
              {t('registration.title')}
            </>
          )}
        </button>
      </div>
    </div>
  );
};