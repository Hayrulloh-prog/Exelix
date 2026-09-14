import { useState, useEffect } from 'react';
import { Bell, X } from 'lucide-react';
import toast from 'react-hot-toast';

export function PushNotificationPrompt() {
  const [showPrompt, setShowPrompt] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>('default');

  useEffect(() => {
    // Очищаем старые записи о закрытии промпта при каждой загрузке
    localStorage.removeItem('pushPromptPermanentlyDismissed');
    localStorage.removeItem('pushPromptDismissed');

    // Проверяем текущий статус разрешения
    if ('Notification' in window) {
      setPermission(Notification.permission);

      // Показываем промпт только если уведомления еще не включены
      if (Notification.permission !== 'granted') {
        // Показываем через 3 секунды после загрузки страницы
        const timer = setTimeout(() => {
          setShowPrompt(true);
        }, 3000);

        return () => clearTimeout(timer);
      }
    }
  }, []);

  const requestPermission = async () => {
    try {
      const permission = await Notification.requestPermission();
      setPermission(permission);

      if (permission === 'granted') {
        toast.success('✅ Push-уведомления включены!');

        // Подписываемся на push-уведомления
        await subscribeToPush();

        // Скрываем промпт
        setShowPrompt(false);
      } else if (permission === 'denied') {
        toast.error('❌ Push-уведомления отключены');
        setShowPrompt(false);
      }
    } catch (error) {
      console.error('Error requesting notification permission:', error);
      toast.error('Ошибка запроса разрешений');
    }
  };

  const closePrompt = () => {
    setShowPrompt(false);
    // НЕ запоминаем что пользователь закрыл промпт - будем спрашивать снова при входе
  };

  const subscribeToPush = async () => {
    if ('serviceWorker' in navigator && 'PushManager' in window) {
      try {
        const registration = await navigator.serviceWorker.ready;

        const vapidPublicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY || 'BMtQbKRgvzh3MuF3V1TJAPJ79kJp279W4_Dn1fCoelpAF4rEIJXYGNBC9e0j4r9nLJzWitplpuboFe3Vj2BwL9g';
        const applicationServerKey = urlB64ToUint8Array(vapidPublicKey);

        const subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey
        });

        // Отправляем подписку на сервер
        await sendSubscriptionToServer(subscription);

      } catch (error) {
        console.error('Error subscribing to push:', error);
      }
    }
  };

  const sendSubscriptionToServer = async (subscription: any) => {
    try {
      const token = localStorage.getItem('userToken') || localStorage.getItem('adminToken');

      if (token) {
        await fetch(`${API_BASE_URL}/api/v1/users/push-subscribe`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ subscription })
        });
      }
    } catch (error) {
      console.error('Error sending subscription to server:', error);
    }
  };

  if (!showPrompt) {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 max-w-sm bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 p-4 z-50">
      <div className="flex items-start space-x-3">
        <div className="flex-shrink-0">
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
            permission === 'denied'
              ? 'bg-gradient-to-br from-red-500 to-pink-600'
              : 'bg-gradient-to-br from-blue-500 to-indigo-600'
          }`}>
            <Bell className="w-5 h-5 text-white" />
          </div>
        </div>

        <div className="flex-1">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-1">
            {permission === 'denied'
              ? 'Включите уведомления?'
              : 'Включить уведомления?'
            }
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
            {permission === 'denied'
              ? 'Уведомления отключены. Включите их чтобы не пропустить сообщения'
              : 'Получайте уведомления о сообщениях на вашем телефоне в реальном времени'
            }
          </p>

          <div className="flex space-x-2">
            <button
              onClick={requestPermission}
              className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200"
            >
              Включить
            </button>
          </div>
        </div>

        <button
          onClick={closePrompt}
          className="flex-shrink-0 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

// Helper function to convert VAPID key
function urlB64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
