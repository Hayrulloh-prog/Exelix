import React, { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Shield, ArrowLeft, Loader2, AlertCircle } from "lucide-react";

export function LoginPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    const errorParam = searchParams.get("error");
    if (errorParam) {
      if (errorParam === "no_code_provided") {
        setErrorMsg(t("loginPage.errorNoCode"));
      } else if (errorParam === "token_exchange_failed") {
        setErrorMsg(t("loginPage.errorTokenExchange"));
      } else if (errorParam === "profile_fetch_failed") {
        setErrorMsg(t("loginPage.errorProfileFetch"));
      } else if (errorParam === "account_linked_to_different_qr") {
        setErrorMsg(t("errors.accountLinkedToDifferentQR", "Этот Google аккаунт уже привязан к другому QR-коду."));
      } else if (errorParam === "google_account_exists") {
        setErrorMsg(t("errors.googleAccountExists", "Пользователь с таким Google аккаунтом уже существует."));
      } else {
        setErrorMsg(t("loginPage.errorServer"));
      }
    }
  }, [searchParams, t]);

  const handleGoogleLogin = () => {
    setLoading(true);
    const backendUrl = import.meta.env.VITE_API_URL || "/api";
    const qrToken = searchParams.get("qrToken");
    window.location.href = `${backendUrl}/v1/auth/google${qrToken ? `?qrToken=${qrToken}` : ''}`;
  };

  return (
    <div className="flex-1 overflow-y-auto hero-gradient flex items-center justify-center py-6 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="bg-white dark:bg-gray-800 py-6 px-4 shadow-2xl rounded-2xl border border-gray-100 dark:border-gray-700 sm:px-10">
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl mb-2 shadow-xl">
              <Shield className="w-8 h-8 text-white" />
            </div>
            <h2 className="mt-2 mb-4 text-2xl md:text-3xl font-extrabold text-gray-900 dark:text-white">
              {t("loginPage.title")}
            </h2>
            <p className="mt-2 mb-6 md:mb-8 text-sm text-gray-600 dark:text-gray-400">
              {t("loginPage.subtitle")}
            </p>
          </div>

          {errorMsg && (
            <div className="mb-6 p-4 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-200 text-sm flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div className="space-y-4 md:space-y-6">
            <button
              onClick={handleGoogleLogin}
              disabled={loading}
              className="w-full flex justify-center items-center gap-3 px-6 py-4 border border-gray-300 dark:border-gray-600 rounded-2xl bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 text-gray-700 dark:text-white font-semibold shadow-md hover:shadow-lg transition-all duration-200 transform hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
              ) : (
                <svg className="w-5 h-5" viewBox="0 0 24 24">
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
              {loading ? t("loginPage.redirecting") : t("loginPage.googleButton")}
            </button>

            <div className="relative flex py-2 items-center">
              <div className="flex-grow border-t border-gray-200 dark:border-gray-700"></div>
              <span className="flex-shrink mx-4 text-gray-400 text-xs uppercase font-medium">EXELIX</span>
              <div className="flex-grow border-t border-gray-200 dark:border-gray-700"></div>
            </div>

            <button
              onClick={() => navigate("/")}
              className="w-full flex justify-center items-center gap-2 px-6 pt-0 pb-3 border border-transparent text-sm font-semibold rounded-2xl text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              {t("loginPage.homeLink")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
