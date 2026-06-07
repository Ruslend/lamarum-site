export async function submitApplication(data, { save, notify, onNotificationError = () => {} }) {
  const application = await save(data);

  try {
    await notify(application);
  } catch (error) {
    onNotificationError(error, application);
  }

  return application;
}
