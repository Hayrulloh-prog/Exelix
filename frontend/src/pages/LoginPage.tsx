import React, { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Shield, ArrowLeft, Loader2, AlertCircle, LogIn, UserPlus, QrCode, ArrowRight } from "lucide-react";

export function LoginPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const modeParam = searchParams.get("mode");
  const errorParam = searchParams.get("error");

  const [activeTab, setActiveTab] = useState<"login" | "register">(
    modeParam === "register" || errorParam === "user_not_found" ? "register" : "login"
  );

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [qrTokenInput, setQrTokenInput] = useState("");
  const [qrInputError, setQrInputError] = useState<string | null>(null);

  useEffect(() => {
    if (errorParam) {
      if (errorParam === "user_not_found") {
        setErrorMsg(t("loginPage.errorUserNotFound", "Аккаунт не найден. Перейдите во вкладку «Регистрация» или введите ваш QR-код."));
      } else if (errorParam === "no_code_provided") {
        setErrorMsg(t("loginPage.errorNoCode", "Код авторизации не получен."));
      } else if (errorParam === "token_exchange_failed") {
        setErrorMsg(t("loginPage.errorTokenExchange", "Не удалось обменять код на токен."));
      } else if (errorParam === "profile_fetch_failed") {
        setErrorMsg(t("loginPage.errorProfileFetch", "Не удалось получить профиль пользователя."));
      } else if (errorParam === "account_linked_to_different_qr") {
        setErrorMsg(t("errors.accountLinkedToDifferentQR", "Этот Google аккаунт уже привязан к другому QR-коду."));
      } else if (errorParam === "google_account_exists") {
        setErrorMsg(t("errors.googleAccountExists", "Пользователь с таким Google аккаунтом уже существует."));
      } else {
        setErrorMsg(t("loginPage.errorServer", "Произошла ошибка авторизации на сервере."));
      }
    }
  }, [searchParams, t, errorParam]);

  const handleGoogleLogin = () => {
    setLoading(true);
    const backendUrl = import.meta.env.VITE_API_URL || "/api";
    const qrToken = searchParams.get("qrToken");
    window.location.href = `${backendUrl}/v1/auth/google${qrToken ? `?qrToken=${qrToken}` : ''}`;
  };

  const handleRegisterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanToken = qrTokenInput.trim();
    if (!cleanToken) {
      setQrInputError(t("loginPage.qrInputEmpty", "Пожалуйста, введите токен QR-кода"));
      return;
    }
    setQrInputError(null);
    navigate(`/qr/${cleanToken}`);
  };

  return (
    <div className="flex-1 overflow-y-auto hero-gradient flex items-center justify-center py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-6">
        {/* Card Container */}
        <div className="bg-white/95 dark:bg-gray-800/95 backdrop-blur-md py-8 px-4 shadow-2xl rounded-3xl border border-gray-100 dark:border-gray-700/80 sm:px-10 transition-all duration-300">
          
          {/* Top Logo & Title */}
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl mb-3 shadow-lg shadow-blue-500/20">
              <Shield className="w-8 h-8 text-white" />
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight">
              {t("common.appName", "EXELIX")}
            </h2>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
              {t("loginPage.subtitle", "Управляйте своим профилем автомобиля EXELIX")}
            </p>
          </div>

          {/* Navigation Tabs (Login / Register) */}
          <div className="flex bg-gray-100 dark:bg-gray-700/60 p-1.5 rounded-2xl mb-6 border border-gray-200/50 dark:border-gray-600/50">
            <button
              type="button"
              onClick={() => {
                setActiveTab("login");
                setErrorMsg(null);
              }}
              className={`flex-1 py-2.5 px-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all duration-200 ${
                activeTab === "login"
                  ? "bg-white dark:bg-gray-800 text-blue-600 dark:text-blue-400 shadow-md"
                  : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
              }`}
            >
              <LogIn className="w-4 h-4" />
              <span>{t("loginPage.tabLogin", "Авторизация")}</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab("register");
                setErrorMsg(null);
              }}
              className={`flex-1 py-2.5 px-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all duration-200 ${
                activeTab === "register"
                  ? "bg-white dark:bg-gray-800 text-purple-600 dark:text-purple-400 shadow-md"
                  : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
              }`}
            >
              <UserPlus className="w-4 h-4" />
              <span>{t("loginPage.tabRegister", "Регистрация")}</span>
            </button>
          </div>

          {/* Error Message Alert */}
          {errorMsg && (
            <div className="mb-6 p-4 rounded-2xl bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800/60 text-red-800 dark:text-red-200 text-sm flex flex-col gap-2">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                <span className="leading-relaxed">{errorMsg}</span>
              </div>
              {errorParam === "user_not_found" && activeTab !== "register" && (
                <button
                  type="button"
                  onClick={() => setActiveTab("register")}
                  className="mt-1 self-end inline-flex items-center gap-1.5 text-xs font-semibold text-red-700 dark:text-red-300 hover:underline"
                >
                  {t("loginPage.continueRegister", "Продолжить регистрацию")}
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          )}

          {/* TAB 1: LOGIN */}
          {activeTab === "login" && (
            <div className="space-y-5">
              <p className="text-xs sm:text-sm text-center text-gray-500 dark:text-gray-400">
                Для входа в имеющийся личный кабинет авторизуйтесь через Google:
              </p>

              <button
                onClick={handleGoogleLogin}
                disabled={loading}
                className="w-full flex justify-center items-center gap-3 px-6 py-3.5 border border-gray-300 dark:border-gray-600 rounded-2xl bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-650 text-gray-800 dark:text-white font-semibold shadow-md hover:shadow-lg transition-all duration-200 transform hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
                ) : (
                  <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    />
                  </svg>
                )}
                <span>{loading ? t("loginPage.redirecting", "Перенаправление...") : t("loginPage.googleButton", "Войти через Google")}</span>
              </button>

              <div className="pt-2 text-center">
                <button
                  type="button"
                  onClick={() => setActiveTab("register")}
                  className="text-xs text-blue-600 dark:text-blue-400 hover:underline font-medium"
                >
                  Впервые на сайте? Нажмите для регистрации QR-кода
                </button>
              </div>
            </div>
          )}

          {/* TAB 2: REGISTER */}
          {activeTab === "register" && (
            <form onSubmit={handleRegisterSubmit} className="space-y-5">
              <div className="text-center">
                <div className="inline-flex items-center justify-center w-12 h-12 bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 rounded-2xl mb-2">
                  <QrCode className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                  {t("loginPage.registerTitle", "Регистрация по QR-коду")}
                </h3>
                <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                  {t("loginPage.registerSubtitle", "Введите токен вашего QR-кода EXELIX для регистрации")}
                </p>
              </div>

              <div>
                <label htmlFor="qrToken" className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                  Токен QR-кода
                </label>
                <div className="relative">
                  <input
                    id="qrToken"
                    type="text"
                    value={qrTokenInput}
                    onChange={(e) => {
                      setQrTokenInput(e.target.value);
                      setQrInputError(null);
                    }}
                    placeholder={t("loginPage.qrInputPlaceholder", "Введите QR-код (например: ABC123XYZ)")}
                    className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-700/80 border border-gray-300 dark:border-gray-600 rounded-2xl text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all placeholder:text-gray-400"
                  />
                </div>
                {qrInputError && (
                  <p className="text-xs text-red-500 mt-1.5 font-medium">{qrInputError}</p>
                )}
              </div>

              <button
                type="submit"
                className="w-full flex justify-center items-center gap-2 px-6 py-3.5 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white font-bold rounded-2xl shadow-lg shadow-purple-500/25 transition-all duration-200 transform hover:-translate-y-0.5"
              >
                <span>{t("loginPage.continueRegister", "Продолжить регистрацию")}</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              <p className="text-xs text-center text-gray-500 dark:text-gray-400 pt-1">
                Или отсканируйте физический QR-код вашей камерой смартфона.
              </p>
            </form>
          )}

          {/* Divider & Back Home */}
          <div className="mt-6 pt-4 border-t border-gray-100 dark:border-gray-700/80">
            <button
              type="button"
              onClick={() => navigate("/")}
              className="w-full flex justify-center items-center gap-2 text-sm font-semibold text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-white transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>{t("loginPage.homeLink", "На главную")}</span>
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}

