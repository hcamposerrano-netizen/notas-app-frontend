// =================================================================
// 🚀 MÓDULO DE GESTIÓN DE NOTIFICACIONES PUSH
// =================================================================

const PushManager = {
    app: null,
    vapidPublicKey: '',
    API_BASE_URL: "https://notas-app-backend-q1ne.onrender.com", // Asegúrate que esta URL sea la correcta

    // Convierte la clave VAPID para que el navegador la entienda
    _urlBase64ToUint8Array(base64String) {
        const padding = '='.repeat((4 - base64String.length % 4) % 4);
        const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
        const rawData = window.atob(base64);
        const outputArray = new Uint8Array(rawData.length);
        for (let i = 0; i < rawData.length; ++i) {
            outputArray[i] = rawData.charCodeAt(i);
        }
        return outputArray;
    },

    // Pide permiso al usuario y envía la suscripción al backend
    async subscribe() {
        if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
            console.warn('Push messaging no es soportado.');
            return;
        }

        try {
            const registration = await navigator.serviceWorker.ready;
            let subscription = await registration.pushManager.getSubscription();

            if (subscription === null) {
                console.log('Creando nueva suscripción...');
                subscription = await registration.pushManager.subscribe({
                    userVisibleOnly: true,
                    applicationServerKey: this._urlBase64ToUint8Array(this.vapidPublicKey)
                });
            }
            
            // Usamos el método fetchWithAuth de la app principal para la autenticación
            await this.app.fetchWithAuth(`${this.API_BASE_URL}/api/save-subscription`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(subscription)
            });
            console.log('✅ Suscripción guardada en el backend.');

        } catch (error) {
            console.error('❌ Error al suscribirse a las notificaciones push:', error);
        }
    },

    // Punto de entrada que será llamado por app.js
    init(appInstance, vapidKey) {
        console.log('Inicializando gestor de notificaciones push...');
        this.app = appInstance;
        this.vapidPublicKey = vapidKey;
        this.subscribe();
    }
};