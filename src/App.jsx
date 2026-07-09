import { useEffect, useState } from "react";
import {
  ArrowRight,
  BookOpen,
  CalendarCheck,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  CircleHelp,
  Clock3,
  ClipboardCheck,
  FileText,
  GraduationCap,
  Laptop,
  ListChecks,
  Menu,
  MessageCircle,
  Send,
  ShieldCheck,
  Sparkles,
  Target,
} from "lucide-react";
import founderLlamaBg from "./assets/founder-llama-bg.jpg";
import {
  audiences,
  benefits,
  courses,
  examTopics,
  faqs,
  navItems,
  ogeFormats,
  preparationRoadmap,
  prices,
  reasons,
  reviews,
  steps,
} from "./data.js";

const iconMap = [Laptop, Target, ClipboardCheck, GraduationCap];
const scheduleUnavailableMessage = "Расписание временно недоступно. Можно записаться через Telegram";

function LogoMark({ compact = false }) {
  return (
    <span className={compact ? "logo-mark compact" : "logo-mark"} aria-hidden="true">
      <svg viewBox="0 0 64 64" role="img">
        <path d="M20 25 16 9c-.7-2.6 2.7-4.2 4.4-2.1l9.2 11.5h5L45 7c1.8-2 5.1-.2 4.2 2.4L44 25" />
        <path d="M18 29c0-9 6.2-15 14-15s14 6 14 15v7c0 10-6.3 17-14 17S18 46 18 36v-7Z" />
        <path d="M22 36h20M25 29h5m4 0h5" />
        <path d="M25 43c4 3 10 3 14 0" />
        <path d="M23 30c2-3 6-3 8-.5M33 29.5c2-2.5 6-2.5 8 .5" />
      </svg>
    </span>
  );
}

function LlamaIllustration({ variant = "tablet", label }) {
  const isMic = variant === "mic";
  const isPhone = variant === "phone";

  return (
    <figure className={`llama-card llama-card-${variant}`} aria-label={label}>
      <svg viewBox="0 0 220 220" role="img">
        <rect x="26" y="28" width="168" height="166" rx="8" className="llama-bg" />
        <path d="M76 82 65 37c-.9-4.2 4.7-6.4 7.3-3l24.5 31.3h25.4L146.7 34c2.6-3.4 8.2-1.2 7.3 3l-11 45" className="llama-ears" />
        <path d="M70 91c0-32 18.2-51 40-51s40 19 40 51v29c0 35-18.6 58-40 58s-40-23-40-58V91Z" className="llama-face" />
        <path d="M82 137c7 10 17 15 28 15s21-5 28-15v31c-7 8-16 12-28 12s-21-4-28-12v-31Z" className="llama-jacket" />
        <path d="M96 146h28l-14 14-14-14Z" className="llama-shirt" />
        <path d="M102 157h16l-8 8-8-8Z" className="llama-bow" />
        <path d="M82 98h24m8 0h24" className="llama-glasses" />
        <circle cx="94" cy="98" r="11" className="llama-lens" />
        <circle cx="126" cy="98" r="11" className="llama-lens" />
        <path d="M104 125c4 4 8 4 12 0" className="llama-smile" />
        {isMic ? (
          <>
            <path d="M148 128h21v44h-21z" className="device" />
            <path d="M158.5 122v57m-14 0h28" className="device-line" />
            <path d="M156 77c14 5 24 17 26 32M63 106c3-13 12-23 24-29" className="signal" />
          </>
        ) : isPhone ? (
          <>
            <rect x="147" y="119" width="25" height="48" rx="6" className="device" />
            <path d="M155 128h9m-8 28h7" className="device-line" />
            <path d="M48 81h24m-18 18h14m93-15h18m-12 18h22" className="signal" />
          </>
        ) : (
          <>
            <rect x="135" y="121" width="52" height="36" rx="5" className="device" />
            <path d="M144 134h17m-17 10h30" className="device-line" />
            <rect x="38" y="150" width="58" height="34" rx="5" className="device device-soft" />
            <path d="M49 162h22m-22 10h34" className="device-line" />
          </>
        )}
      </svg>
    </figure>
  );
}

function Header() {
  return (
    <header className="site-header">
      <a className="brand" href="#home" aria-label="Ламарум, на главную">
        <LogoMark compact />
        <span>Ламарум</span>
      </a>

      <nav className="desktop-nav" aria-label="Основная навигация">
        {navItems.map((item) => (
          <a key={item.href} href={item.href}>
            {item.label}
          </a>
        ))}
      </nav>

      <a className="header-cta" href="#schedule">
        Записаться
        <ChevronRight size={18} aria-hidden="true" />
      </a>

      <details className="mobile-nav">
        <summary aria-label="Открыть меню">
          <Menu size={22} aria-hidden="true" />
        </summary>
        <div className="mobile-nav-panel">
          {navItems.map((item) => (
            <a key={item.href} href={item.href}>
              {item.label}
            </a>
          ))}
          <a className="mobile-cta" href="#schedule">
            Записаться
          </a>
        </div>
      </details>
    </header>
  );
}

function Hero() {
  return (
    <section id="home" className="hero-section">
      <img className="hero-photo" src={founderLlamaBg} alt="Основатель Ламарум рядом с ламами" />
      <div className="hero-shade" aria-hidden="true" />
      <div className="container hero-content">
        <p className="eyebrow">
          <Sparkles size={18} aria-hidden="true" />
          Живая онлайн-школа Ламарум
        </p>
        <h1>Подготовка к ОГЭ по информатике простым языком</h1>
        <p className="hero-lead">
          Школа Ламарум помогает ученикам 8-9 классов разобраться в информатике, закрыть пробелы
          и уверенно подготовиться к экзамену.
        </p>
        <div className="hero-actions">
          <a className="button primary" href="#schedule">
            <CalendarCheck size={20} aria-hidden="true" />
            Записаться на пробный урок
          </a>
          <a className="button ghost" href="#courses">
            <BookOpen size={20} aria-hidden="true" />
            Посмотреть курсы
          </a>
        </div>
        <div className="hero-facts" aria-label="Ключевые факты">
          <span>8-9 класс</span>
          <span>Онлайн</span>
          <span>План подготовки</span>
        </div>
      </div>
    </section>
  );
}

function Benefits() {
  return (
    <section className="benefits-band" aria-label="Преимущества">
      <div className="container benefits-grid">
        {benefits.map((benefit) => (
          <div className="benefit-item" key={benefit}>
            <CheckCircle2 size={20} aria-hidden="true" />
            <span>{benefit}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function Audience() {
  return (
    <section className="section" aria-labelledby="audience-title">
      <div className="container two-column audience-layout">
        <div>
          <p className="section-kicker">Для кого</p>
          <h2 id="audience-title">Курс подстраивается под стартовый уровень ученика</h2>
          <p className="section-lead">
            Мы не требуем “любить информатику” с первого дня. Важно понять, где сложно, и спокойно
            выстроить маршрут подготовки.
          </p>
          <div className="audience-grid">
            {audiences.map((item, index) => {
              const Icon = iconMap[index];
              return (
                <article className="info-card" key={item.title}>
                  <Icon size={24} aria-hidden="true" />
                  <h3>{item.title}</h3>
                  <p>{item.text}</p>
                </article>
              );
            })}
          </div>
        </div>
        <LlamaIllustration variant="tablet" label="Лама-наставник с ноутбуком и планшетом" />
      </div>
    </section>
  );
}

function Courses() {
  return (
    <section id="courses" className="section section-soft" aria-labelledby="courses-title">
      <div className="container">
        <div className="section-heading">
          <p className="section-kicker">Курсы Ламарум</p>
          <h2 id="courses-title">Три формата подготовки к ОГЭ</h2>
          <p>
            Можно стартовать с нуля, быстро повторить основные темы или заниматься индивидуально.
          </p>
        </div>
        <div className="course-grid">
          {courses.map((course) => (
            <article className="course-card" key={course.title}>
              <div className="card-topline">
                <span>{course.tag}</span>
                <LogoMark compact />
              </div>
              <h3>{course.title}</h3>
              <p>{course.text}</p>
              <ul>
                {course.items.map((item) => (
                  <li key={item}>
                    <CheckCircle2 size={18} aria-hidden="true" />
                    {item}
                  </li>
                ))}
              </ul>
              <a className="button secondary" href="#schedule">
                Выбрать курс
                <ArrowRight size={18} aria-hidden="true" />
              </a>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function Process() {
  return (
    <section id="process" className="section" aria-labelledby="process-title">
      <div className="container two-column process-layout">
        <div>
          <p className="section-kicker">Как проходит обучение</p>
          <h2 id="process-title">Как проходит подготовка в Lamarum</h2>
          <p className="section-lead">
            Сначала разбираемся в ситуации ученика, а потом ведём подготовку по шагам: от
            диагностики до пробных вариантов и повторения.
          </p>
          <LlamaIllustration variant="mic" label="Лама-преподаватель с наушниками и микрофоном" />
        </div>
        <ol className="steps-list">
          {steps.map((step, index) => (
            <li key={step.title}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <div>
                <h3>{step.title}</h3>
                <p>{step.text}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

function Program() {
  return (
    <section id="program" className="section section-dark" aria-labelledby="program-title">
      <div className="container">
        <div className="section-heading inverted">
          <p className="section-kicker">Программа подготовки</p>
          <h2 id="program-title">План подготовки к ОГЭ</h2>
          <p>
            Движемся по дорожной карте: сначала диагностика и база, затем задания, компьютерная
            часть, пробники и финальное повторение.
          </p>
        </div>
        <ol className="roadmap-list">
          {preparationRoadmap.map((stage, index) => (
            <li key={stage}>
              <span>Этап {index + 1}</span>
              <h3>{stage}</h3>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

function ExamTopics() {
  return (
    <section id="topics" className="section" aria-labelledby="topics-title">
      <div className="container">
        <div className="section-heading">
          <p className="section-kicker">Что изучаем</p>
          <h2 id="topics-title">Что изучаем на ОГЭ по информатике</h2>
          <p>Темы сгруппированы так, чтобы родителю было понятно, зачем нужен каждый блок.</p>
        </div>
        <div className="exam-topic-grid">
          {examTopics.map((topic, index) => {
            const icons = [Laptop, BookOpen, ListChecks, FileText];
            const Icon = icons[index];

            return (
              <article className="exam-topic-card" key={topic.title}>
                <Icon size={24} aria-hidden="true" />
                <span>{topic.tasks}</span>
                <h3>{topic.title}</h3>
                <p>{topic.text}</p>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function OgeUpdate() {
  return (
    <section className="section section-soft oge-update-section" aria-labelledby="oge-update-title">
      <div className="container oge-update">
        <div>
          <p className="section-kicker">Актуально для ОГЭ-2026</p>
          <h2 id="oge-update-title">Формат экзамена держим в фокусе</h2>
          <p>
            В 2026 году структура ОГЭ по информатике сохраняет 16 заданий. Особое внимание уделяем
            компьютерной части: файлам, таблицам, презентациям, текстовым документам, алгоритмам и
            программированию.
          </p>
        </div>
        <div className="format-list" aria-label="Актуальные форматы файлов">
          {ogeFormats.map((format) => (
            <span key={format}>{format}</span>
          ))}
        </div>
      </div>
    </section>
  );
}

function Why() {
  return (
    <section className="section" aria-labelledby="why-title">
      <div className="container why-layout">
        <div>
          <p className="section-kicker">Почему Ламарум</p>
          <h2 id="why-title">Спокойная подготовка без хаоса и давления</h2>
          <p className="section-lead">
            Мы держим баланс: достаточно практики, понятные объяснения и уважительное отношение к
            темпу ученика.
          </p>
          <div className="reason-grid">
            {reasons.map((reason) => (
              <article className="reason-card" key={reason.title}>
                <CheckCircle2 size={22} aria-hidden="true" />
                <div>
                  <h3>{reason.title}</h3>
                  <p>{reason.text}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
        <LlamaIllustration variant="phone" label="Лама-эксперт со смартфоном и цифровыми иконками" />
      </div>
    </section>
  );
}

function formatSlotDate(date) {
  const plainDate = parsePlainDate(date);

  return new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "long",
  }).format(new Date(plainDate.year, plainDate.month - 1, plainDate.day, 12, 0, 0));
}

function parsePlainDate(value) {
  const [year, month, day] = String(value).slice(0, 10).split("-").map(Number);

  return { year, month, day };
}

function SlotStatus({ status }) {
  const isAvailable = status === "available";

  return <span className={isAvailable ? "slot-status available" : "slot-status booked"}>{isAvailable ? "Свободно" : "Занято"}</span>;
}

function TrialSchedule() {
  const [slots, setSlots] = useState([]);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [scheduleMessage, setScheduleMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    async function loadSchedule() {
      try {
        const response = await fetch("/api/schedule");
        const result = await response.json().catch(() => ({}));

        if (!response.ok || !Array.isArray(result.slots)) {
          throw new Error(result.message || scheduleUnavailableMessage);
        }

        if (isMounted) {
          setSlots(result.slots);
          setScheduleMessage(
            result.slots.length > 0 ? "" : "Сейчас нет открытых слотов. Можно записаться через Telegram",
          );
        }
      } catch (error) {
        if (isMounted) {
          setSlots([]);
          setScheduleMessage(error.message?.includes("Расписание") ? error.message : scheduleUnavailableMessage);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadSchedule();

    return () => {
      isMounted = false;
    };
  }, []);

  function handleSelectSlot(slot) {
    setSelectedSlot(slot);
    setScheduleMessage("");
  }

  function handleBookingSuccess(slotId) {
    setSlots((currentSlots) =>
      currentSlots.map((slot) => (slot.id === slotId ? { ...slot, status: "booked" } : slot)),
    );
    setSelectedSlot(null);
    setScheduleMessage("Спасибо! Заявка принята. Я свяжусь с вами для подтверждения времени.");
  }

  return (
    <section id="schedule" className="section schedule-section" aria-labelledby="schedule-title">
      <div className="container">
        <div className="section-heading">
          <p className="section-kicker">Пробный урок</p>
          <h2 id="schedule-title">Выберите удобное время для пробного урока</h2>
          <p>
            Выберите свободный слот, заполните короткую анкету, и я подтвержу время в Telegram или
            по телефону.
          </p>
        </div>

        <div className="schedule-layout">
          <div className="slot-list" aria-busy={isLoading ? "true" : "false"}>
            {!isLoading && slots.length === 0 && (
              <div className="schedule-unavailable">
                <ShieldCheck size={28} aria-hidden="true" />
                <h3>Расписание временно недоступно</h3>
                <p>{scheduleUnavailableMessage}</p>
                <a className="button secondary" href="https://t.me/ruslannzz" target="_blank" rel="noreferrer">
                  Написать в Telegram
                  <ArrowRight size={18} aria-hidden="true" />
                </a>
              </div>
            )}
            {slots.map((slot) => {
              const isAvailable = slot.status === "available";
              const isSelected = selectedSlot?.id === slot.id;

              return (
                <article className={isSelected ? "slot-card selected" : "slot-card"} key={slot.id}>
                  <div className="slot-date">
                    <CalendarDays size={22} aria-hidden="true" />
                    <div>
                      <strong>{slot.weekday}</strong>
                      <span>{formatSlotDate(slot.date)}</span>
                    </div>
                  </div>
                  <div className="slot-time">
                    <Clock3 size={20} aria-hidden="true" />
                    <span>{slot.time}</span>
                  </div>
                  <SlotStatus status={slot.status} />
                  <button
                    className="button secondary"
                    type="button"
                    disabled={!isAvailable}
                    onClick={() => handleSelectSlot(slot)}
                  >
                    {isAvailable ? "Записаться" : "Слот занят"}
                    <ArrowRight size={18} aria-hidden="true" />
                  </button>
                </article>
              );
            })}
          </div>

          <div className="booking-panel" id="booking-form">
            {scheduleMessage && <p className="form-status">{scheduleMessage}</p>}
            {selectedSlot ? (
              <BookingForm selectedSlot={selectedSlot} onSuccess={handleBookingSuccess} />
            ) : (
              <div className="booking-placeholder">
                <ShieldCheck size={30} aria-hidden="true" />
                <h3>Форма откроется после выбора слота</h3>
                <p>Нужны имя родителя, имя ученика, класс, контакт и согласие на обработку данных.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function BookingForm({ selectedSlot, onSuccess }) {
  const [status, setStatus] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = Object.fromEntries(new FormData(form).entries());
    const payload = {
      ...formData,
      consent: formData.consent === "on",
      slotId: selectedSlot.id,
    };

    setIsSubmitting(true);
    setStatus("");

    try {
      const response = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        setStatus(result.message || "Не удалось отправить запись. Попробуйте ещё раз позже.");
        return;
      }

      form.reset();
      onSuccess(selectedSlot.id);
    } catch {
      setStatus("Не удалось отправить запись. Попробуйте ещё раз позже.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form className="booking-form" onSubmit={handleSubmit}>
      <label>
        Выбранный слот
        <input name="selectedSlot" type="text" value={selectedSlot.label} readOnly required />
      </label>
      <label>
        Имя родителя
        <input name="parentName" type="text" minLength="2" maxLength="80" placeholder="Как к вам обращаться" required />
      </label>
      <label>
        Имя ученика
        <input name="studentName" type="text" minLength="2" maxLength="80" placeholder="Имя ученика" required />
      </label>
      <label>
        Класс ученика
        <select name="grade" defaultValue="" required>
          <option value="" disabled>
            Выберите класс
          </option>
          <option>8 класс</option>
          <option>9 класс</option>
          <option>Другой класс</option>
        </select>
      </label>
      <label>
        Telegram или телефон
        <input name="contact" type="text" minLength="3" maxLength="80" placeholder="@username или телефон" required />
      </label>
      <label>
        Цель обучения
        <textarea name="goal" rows="3" maxLength="1000" placeholder="Например: подтянуть базу, подготовиться к ОГЭ, перестать бояться задач" />
      </label>
      <label>
        Комментарий
        <textarea name="comment" rows="3" maxLength="1000" placeholder="Что важно знать перед пробным уроком?" />
      </label>
      <label className="consent-field">
        <input name="consent" type="checkbox" required />
        <span>
          Я согласен(на) на обработку персональных данных и подтверждаю, что являюсь родителем или
          законным представителем ученика.{" "}
          <a href="/privacy.html" target="_blank" rel="noreferrer">
            Политика конфиденциальности
          </a>
        </span>
      </label>
      <label className="hp-field" aria-hidden="true">
        Сайт
        <input name="website" type="text" tabIndex="-1" autoComplete="off" />
      </label>
      <button className="button primary" type="submit" disabled={isSubmitting}>
        <Send size={20} aria-hidden="true" />
        {isSubmitting ? "Отправляем..." : "Отправить запись"}
      </button>
      {status && <p className="form-status error">{status}</p>}
    </form>
  );
}

function Prices() {
  return (
    <section id="prices" className="section section-soft" aria-labelledby="prices-title">
      <div className="container">
        <div className="section-heading">
          <p className="section-kicker">Цены</p>
          <h2 id="prices-title">Начать можно с бесплатного пробного урока</h2>
          <p>Точные условия обсуждаются после пробного урока.</p>
        </div>
        <div className="price-grid">
          {prices.map((price) => (
            <article className={price.accent ? "price-card accent" : "price-card"} key={price.title}>
              {price.accent && <span className="popular">Популярно</span>}
              <h3>{price.title}</h3>
              <p className="price">{price.price}</p>
              <p>{price.text}</p>
              <a className="button secondary" href="#schedule">
                Записаться
                <ArrowRight size={18} aria-hidden="true" />
              </a>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function Reviews() {
  return (
    <section id="reviews" className="section" aria-labelledby="reviews-title">
      <div className="container">
        <div className="section-heading">
          <p className="section-kicker">Отзывы</p>
          <h2 id="reviews-title">Так может звучать результат спокойной подготовки</h2>
        </div>
        <div className="review-grid">
          {reviews.map((review) => (
            <article className="review-card" key={review.name}>
              <MessageCircle size={24} aria-hidden="true" />
              <strong>{review.name}</strong>
              <dl>
                <div>
                  <dt>Цель</dt>
                  <dd>{review.goal}</dd>
                </div>
                <div>
                  <dt>Результат</dt>
                  <dd>{review.result}</dd>
                </div>
              </dl>
              <p>“{review.text}”</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function Faq() {
  return (
    <section id="faq" className="section section-soft" aria-labelledby="faq-title">
      <div className="container faq-layout">
        <div>
          <p className="section-kicker">Частые вопросы</p>
          <h2 id="faq-title">Ответы перед пробным уроком</h2>
          <p className="section-lead">
            Если останутся детали, их удобно обсудить после заявки или на первом созвоне.
          </p>
        </div>
        <div className="faq-list">
          {faqs.map((item) => (
            <details className="faq-item" key={item.question}>
              <summary>
                <CircleHelp size={20} aria-hidden="true" />
                {item.question}
              </summary>
              <p>{item.answer}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer id="contacts" className="site-footer">
      <div className="container footer-grid">
        <div>
          <a className="brand footer-brand" href="#home">
            <LogoMark compact />
            <span>Ламарум</span>
          </a>
          <p>Подготовка к ОГЭ по информатике</p>
        </div>
        <address>
          <a href="https://t.me/ruslannzz" target="_blank" rel="noreferrer">Telegram: @ruslannzz</a>
          <span>Email: ruslannz00@mail.ru</span>
        </address>
        <p className="copyright">© 2026 Ламарум. Все права защищены.</p>
      </div>
    </footer>
  );
}

export default function App() {
  return (
    <>
      <Header />
      <main>
        <Hero />
        <Benefits />
        <Audience />
        <Courses />
        <Process />
        <Program />
        <ExamTopics />
        <OgeUpdate />
        <TrialSchedule />
        <Why />
        <Prices />
        <Reviews />
        <Faq />
      </main>
      <Footer />
    </>
  );
}
