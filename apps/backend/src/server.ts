import { createApp } from './app.js';
import { notificationService } from './services/notification.service.js';

const port = Number(process.env.PORT ?? 3000);
const app = createApp();
notificationService.abonner(); // F-12 : les événements métier déclenchent les courriels de service

app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`CopropHub backend démarré sur le port ${port}`);
});
