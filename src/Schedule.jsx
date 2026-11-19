import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";

import { initialScheduleSlots } from "./data.js";

const preview =
  import.meta.env.DEV &&
  new URLSearchParams(location.search).get("preview") === "b";

const dateLabel = (day, options) =>
  new Date(day + "T12:00:00").toLocaleDateString("ru-RU", options);

function BookingDialog({ slot, onClose, onBooked, onConflict }) {
  const dialog = useRef(null);
  const form = useRef(null);
  const title = useRef(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [receipt, setReceipt] = useState("");
  const [conflict, setConflict] = useState(false);

  useEffect(() => {
    setError("");
    setConflict(false);
    setReceipt("");
    if (!slot) return;
    const modal = dialog.current;
    modal.showModal();
    form.current.elements.parentName.focus();
    document.body.classList.add("modal-open");
    return () => {
      modal.close();
      document.body.classList.remove("modal-open");
    };
  }, [slot]);

  useEffect(() => {
    if (receipt) title.current.focus();
  }, [receipt]);

  async function submit(event) {
    event.preventDefault();
    if (sending || conflict || !slot) return;
    if (preview) {
      setReceipt(slot.label);
      form.current.reset();
      onBooked(slot.id);
      return;
    }
    const data = Object.fromEntries(new FormData(form.current));
    setSending(true);
    setError("");
    try {
      const response = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...data,
          slotId: String(slot.id),
          consent: data.consent === "on",
        }),
      });
      const result = await response.json();
      if (response.status === 409) {
        setConflict(true);
        onConflict(slot.id);
      }
      if (!response.ok || !result.ok)
        throw new Error(
          result.message || "Не удалось отправить заявку. Попробуйте ещё раз.",
        );
      setReceipt(slot.label);
      form.current.reset();
      onBooked(slot.id);
    } catch (err) {
      setError(
        err instanceof TypeError || err instanceof SyntaxError
          ? "Ошибка связи. Проверьте подключение и повторите отправку."
          : err.message,
      );
    } finally {
      setSending(false);
    }
  }
  return (
    <dialog
      ref={dialog}
      aria-labelledby="booking-title"
      onCancel={(event) => {
        event.preventDefault();
        if (!sending) onClose();
      }}
    >
      <button
        className="close"
        type="button"
        disabled={sending}
        onClick={onClose}
        aria-label="Закрыть форму"
      >
        <X className="icon" aria-hidden="true" />
      </button>
      <p className="eyebrow">Запись на занятие</p>
      <h2 id="booking-title" tabIndex="-1" ref={title}>
        {receipt
          ? preview
            ? "Форма проверена"
            : "Заявка принята"
          : "Пробный урок"}
      </h2>
      <p id="summary-slot">{receipt || slot?.label}</p>
      {receipt && (
        <div className="success">
          <p>
            {preview
              ? "Демонстрационная запись завершена."
              : "Преподаватель свяжется с вами для подтверждения времени."}
          </p>
          <button className="button primary" onClick={onClose}>
            Вернуться к расписанию
          </button>
        </div>
      )}
      {preview && !receipt && (
        <p className="demo-note">
          Демонстрация. Используйте вымышленные данные.
        </p>
      )}
      <form ref={form} hidden={!!receipt} onSubmit={submit}>
        <div className="form-row">
          <label>
            Имя родителя
            <input name="parentName" required minLength={2} maxLength={80} />
          </label>
          <label>
            Имя ученика
            <input name="studentName" required minLength={2} maxLength={80} />
          </label>
        </div>
        <label>
          Класс
          <select name="grade" required defaultValue="">
            <option value="" disabled>
              Выберите класс
            </option>
            <option>8 класс</option>
            <option>9 класс</option>
            <option>Другой класс</option>
          </select>
        </label>
        <label>
          Телефон или Telegram
          <input
            name="contact"
            required
            minLength={3}
            maxLength={80}
            placeholder="+7… или @username"
          />
        </label>
        <details>
          <summary>Цель и комментарий (по желанию)</summary>
          <label>
            Цель занятий
            <textarea name="goal" rows={2} maxLength={1000} />
          </label>
          <label>
            Комментарий
            <textarea name="comment" rows={2} maxLength={1000} />
          </label>
        </details>
        <label className="consent">
          <input name="consent" type="checkbox" required />
          <span>
            Я родитель или законный представитель ученика и принимаю{" "}
            <a href="/privacy.html" target="_blank" rel="noreferrer">
              условия обработки данных
            </a>
            .
          </span>
        </label>
        <label className="sr" aria-hidden="true">
          Сайт
          <input name="website" tabIndex={-1} autoComplete="off" />
        </label>
        <p className="error" role="alert">
          {error}
        </p>
        {conflict ? (
          <button type="button" className="button primary" onClick={onClose}>
            Выбрать другое время
          </button>
        ) : (
          <button disabled={sending} className="button primary">
            {sending
              ? "Отправляем заявку…"
              : preview
                ? "Проверить запись"
                : "Отправить заявку"}
          </button>
        )}
      </form>
    </dialog>
  );
}

export default function Schedule() {
  const [slots, setSlots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [day, setDay] = useState("");
  const [time, setTime] = useState(null);
  const [booking, setBooking] = useState(null);
  const picker = useRef(null);
  useEffect(() => {
    if (preview) {
      setSlots(initialScheduleSlots);
      setDay(initialScheduleSlots[0].date);
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    async function load() {
      setLoading(true);
      setFailed(false);
      try {
        const response = await fetch("/api/schedule", {
          signal: controller.signal,
          cache: "no-store",
        });
        const data = await response.json();
        if (!response.ok || !Array.isArray(data.slots)) throw new Error();
        const sorted = [...data.slots].sort(
          (a, b) =>
            a.date.localeCompare(b.date) || a.time.localeCompare(b.time),
        );
        setSlots(sorted);
        setDay(
          (sorted.find((slot) => slot.status === "available") || sorted[0])
            ?.date || "",
        );
        setTime(null);
      } catch {
        if (!controller.signal.aborted) setFailed(true);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    load();
    return () => controller.abort();
  }, [attempt]);
  const days = [...new Set(slots.map((slot) => slot.date))];
  const times = slots.filter((slot) => slot.date === day);
  function markBooked(id) {
    setSlots((current) =>
      current.map((slot) =>
        slot.id === id ? { ...slot, status: "booked" } : slot,
      ),
    );
    setTime(null);
  }
  function close() {
    setBooking(null);
    requestAnimationFrame(() =>
      (
        picker.current.querySelector("#choose:not(:disabled)") ||
        picker.current.querySelector("input[name=day]:checked") ||
        picker.current
      ).focus({ preventScroll: true }),
    );
  }
  return (
    <section className="section schedule" id="schedule">
      <div className="wrap booking-grid">
        <div>
          <p className="eyebrow">
            <span className="dash" />
            Расписание
          </p>
          <h2>
            Выберите время
            <br />
            пробного урока
          </h2>
          <p className="section-intro">
            Познакомимся, решим несколько задач и обсудим
            подготовку.
          </p>
        </div>
        <div className="picker" ref={picker} tabIndex={-1} aria-busy={loading}>
          {loading ? (
            <p role="status">Загружаем расписание…</p>
          ) : failed || !days.length ? (
            <>
              <h3>
                {failed
                  ? "Расписание временно недоступно"
                  : "Пока нет свободных дат"}
              </h3>
              <p className="section-intro">
                Можно уточнить время у преподавателя в{" "}
                <a href="https://t.me/ruslannzz">Telegram</a>.
              </p>
              <button
                className="button primary retry"
                onClick={() => setAttempt(attempt + 1)}
              >
                Обновить расписание
              </button>
            </>
          ) : (
            <>
              <div className="picker-head">
                <h3>{dateLabel(day, { month: "long", year: "numeric" })}</h3>
              </div>
              {preview && (
                <p className="demo-note">Демонстрационное расписание</p>
              )}
              <fieldset>
                <legend>День занятия</legend>
                <div className="date-list">
                  {days.map((date) => (
                    <label key={date}>
                      <input
                        type="radio"
                        name="day"
                        checked={day === date}
                        onChange={() => {
                          setDay(date);
                          setTime(null);
                        }}
                      />
                      <span>
                        <small>{dateLabel(date, { weekday: "short" })}</small>
                        {dateLabel(date, { day: "numeric", month: "long" })}
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>
              <fieldset>
                <legend>Время начала</legend>
                <div className="slot-list">
                  {times.map((slot) =>
                    slot.status === "available" ? (
                      <label key={slot.id}>
                        <input
                          type="radio"
                          name="time"
                          checked={slot.id === time?.id}
                          onChange={() => setTime(slot)}
                        />
                        <span>{slot.time}</span>
                      </label>
                    ) : (
                      <button key={slot.id} className="busy-time" disabled>
                        {slot.time} · занято
                      </button>
                    ),
                  )}
                </div>
              </fieldset>
              <button
                className="button primary"
                id="choose"
                disabled={!time}
                onClick={() => setBooking(time)}
              >
                Перейти к записи
              </button>
            </>
          )}
        </div>
      </div>
      <BookingDialog
        slot={booking}
        onClose={close}
        onBooked={markBooked}
        onConflict={markBooked}
      />
    </section>
  );
}
