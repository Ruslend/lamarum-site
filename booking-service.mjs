export async function submitTrialBooking(data, { book, notify, onNotificationError = () => {} }) {
  const booking = await book(data);

  try {
    await notify(booking);
  } catch (error) {
    onNotificationError(error, booking);
  }

  return booking;
}
