import { Fragment, useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import Schedule from "./Schedule.jsx";
import { prices } from "./data.js";
function Header() {
  const [open, setOpen] = useState(false);
  const toggleRef = useRef(null);
  useEffect(() => {
    if (!open) return;
    const desktop = matchMedia("(min-width: 851px)");
    const close = () => setOpen(false);
    const key = (e) => {
      if (e.key === "Escape") {
        close();
        toggleRef.current.focus();
      }
    };
    document.addEventListener("keydown", key);
    desktop.addEventListener("change", close);
    return () => {
      document.removeEventListener("keydown", key);
      desktop.removeEventListener("change", close);
    };
  }, [open]);
  return (
    <header id="top">
      <div className="wrap header-row">
        <a className="brand" href="#top" aria-label="LAMARUM, в начало">
          <img width="42" height="42" src="/brand/mark.svg" alt="" />
          <span>LAMARUM</span>
        </a>
        <nav className="desktop-nav" aria-label="Основная навигация">
          <a href="#program">Программа</a>
          <a href="#method">Методика</a>
          <a href="#schedule">Расписание</a>
          <a href="#faq">Вопросы</a>
        </nav>
        <a href="#schedule" className="head-cta">
          Пробный урок
        </a>
        <button
          type="button"
          className="menu-toggle"
          ref={toggleRef}
          onClick={() => setOpen(!open)}
          aria-label={open ? "Закрыть меню" : "Открыть меню"}
          aria-expanded={open}
          aria-controls="mobile-nav"
        >
          {open ? (
            <X className="icon" aria-hidden="true" />
          ) : (
            <svg
              className="icon"
              aria-hidden="true"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M3 8h18M3 16h18" />
            </svg>
          )}
        </button>
      </div>
      <nav
        aria-label="Мобильная навигация"
        id="mobile-nav"
        hidden={!open}
        onClick={() => setOpen(false)}
      >
        <a href="#program">Программа</a>
        <a href="#method">Методика</a>
        <a href="#schedule">Расписание</a>
        <a href="#faq">Вопросы</a>
      </nav>
    </header>
  );
}
function Hero() {
  return (
    <section id="home" className="hero">
      <div className="wrap hero-inner">
        <div className="hero-copy">
          <p className="eyebrow">
            <span className="dash"></span>Подготовка к ОГЭ
          </p>
          <h1>
            Информатика
            <br />с пониманием<span className="gold">.</span>
          </h1>
          <p className="lede">
            Разбираем логику задач, пишем код и готовимся к экзамену в своём
            темпе.
          </p>
          <div className="actions">
            <a className="button primary" href="#schedule">
              <svg
                className="icon"
                aria-hidden="true"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="3" y="5" width="18" height="16" rx="2" />
                <path d="M7 3v4m10-4v4M3 10h18m-13 5h3" />
              </svg>
              Записаться на пробный урок
            </a>
            <a className="text-link" href="#program">
              Изучить программу
            </a>
          </div>
        </div>
        <figure className="hero-plate">
          <img
            fetchPriority="high"
            src="/brand/plate.svg"
            width="600"
            height="440"
            alt="Фирменная лама с дорожками электронной схемы на чертёжной сетке"
          />
        </figure>
      </div>
      <div className="wrap facts">
        <div className="fact">
          <svg
            className="icon"
            aria-hidden="true"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12 6C9 3 5 3 2 4v15c4-1 7-1 10 2 3-3 6-3 10-2V4c-4-1-7-1-10 2Zm0 0v15" />
          </svg>
          <div>
            <span>Для кого</span>
            <strong>8–9 классы</strong>
          </div>
        </div>
        <div className="fact">
          <svg
            className="icon"
            aria-hidden="true"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect x="2" y="3" width="20" height="15" rx="2" />
            <path d="M8 22h8m-4-4v4" />
          </svg>
          <div>
            <span>Формат занятий</span>
            <strong>Онлайн и офлайн</strong>
          </div>
        </div>
        <div className="fact">
          <svg
            className="icon"
            aria-hidden="true"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="m8 7-5 5 5 5m8-10 5 5-5 5m-3-13-2 16" />
          </svg>
          <div>
            <span>На занятиях</span>
            <strong>Теория и практика</strong>
          </div>
        </div>
      </div>
    </section>
  );
}
function Program() {
  return (
    <section className="section program" id="program">
      <div className="wrap">
        <div className="section-head">
          <div>
            <p className="eyebrow">
              <span className="dash"></span>Программа подготовки
            </p>
            <h2>Что будем изучать</h2>
          </div>
          <p>От базовых понятий до практических задач на компьютере.</p>
        </div>
        <div className="topics" id="topics">
          <article className="topic">
            <svg
              className="topic-art"
              viewBox="0 0 84 68"
              aria-hidden="true"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M10 19h24l16 15h18m-58 17h24l16-17" />
              <circle cx="9" cy="19" r="5" />
              <circle cx="9" cy="51" r="5" />
              <circle cx="73" cy="34" r="5" />
            </svg>
            <h3>Логика и кодирование</h3>
            <p>Высказывания, системы счисления и представление информации.</p>
            <details>
              <summary>Пример задания</summary>
              <p>Переведите двоичное число 101 в десятичную систему.</p>
              <details>
                <summary>Проверить ответ</summary>
                <p>
                  5. Считаем по разрядам справа налево: 1 × 1 + 0 × 2 + 1 × 4 =
                  5.
                </p>
              </details>
            </details>
          </article>
          <article className="topic">
            <svg
              className="topic-art"
              viewBox="0 0 84 68"
              aria-hidden="true"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="m23 17-17 17 17 17m38-34 17 17-17 17m-13-41-12 48" />
            </svg>
            <h3>Алгоритмы и код</h3>
            <p>
              Исполнители, условия и циклы. Учимся читать и писать программы.
            </p>
            <details>
              <summary>Пример задания</summary>
              <p>
                Сколько раз выполнится тело цикла for i in range(3) в Python?
              </p>
              <details>
                <summary>Проверить ответ</summary>
                <p>
                  Три раза. Переменная i последовательно примет значения 0, 1 и
                  2.
                </p>
              </details>
            </details>
          </article>
          <article className="topic">
            <svg
              className="topic-art"
              viewBox="0 0 84 68"
              aria-hidden="true"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <rect x="7" y="10" width="70" height="46" rx="3" />
              <path d="M7 25h70M7 40h70M29 10v46M52 10v46" />
            </svg>
            <h3>Работа с данными</h3>
            <p>Поиск в файлах, электронные таблицы и обработка результатов.</p>
            <details>
              <summary>Пример задания</summary>
              <p>
                В ячейках A1 и A2 записаны 4 и 7. Чему равна формула =A1+A2?
              </p>
              <details>
                <summary>Проверить ответ</summary>
                <p>11. Формула берёт значения из двух ячеек и складывает их.</p>
              </details>
            </details>
          </article>
        </div>
      </div>
    </section>
  );
}
function Method() {
  return (
    <section className="section method" id="method">
      <div className="wrap method-inner" id="process">
        <div>
          <p className="eyebrow">
            <span className="dash"></span>О школе и методике
          </p>
          <h2>
            Как проходит
            <br />
            подготовка
          </h2>
          <p className="section-intro">
            В LAMARUM школьники занимаются онлайн и офлайн. На занятиях
            преподаватель помогает понять ход решения и самостоятельно применить
            его в новой задаче.
          </p>
        </div>
        <ol className="steps">
          <li>
            <h3>Знакомимся на пробном уроке</h3>
            <p>Разбираем несколько задач и вместе выбираем темы для старта.</p>
          </li>
          <li>
            <h3>Отрабатываем тему на практике</h3>
            <p>
              После объяснения решаем задачи. Разбираем, почему сработал каждый
              шаг.
            </p>
          </li>
          <li>
            <h3>Возвращаемся к сложному</h3>
            <p>
              Домашняя практика показывает, что уже получается и что стоит
              повторить.
            </p>
          </li>
        </ol>
        <details className="formats" id="courses">
          <summary>Форматы подготовки</summary>
          <dl>
            <dt>ОГЭ с нуля</dt>
            <dd>
              Базовая теория, практика после каждой темы и домашние задания.
            </dd>
            <dt>Интенсив к ОГЭ</dt>
            <dd>
              Повторение типовых задач, тренировка по вариантам и работа над
              ошибками.
            </dd>
            <dt>Индивидуальные занятия</dt>
            <dd>
              Личный план и подробный разбор тем, которые вызывают трудности.
            </dd>
          </dl>
          <div id="prices">
            <h3>Стоимость занятий</h3>
            <dl>
              {prices.map((item) => (
                <Fragment key={item.title}>
                  <dt>{item.title}</dt>
                  <dd>{item.price}</dd>
                </Fragment>
              ))}
            </dl>
          </div>
        </details>
      </div>
    </section>
  );
}
function Faq() {
  return (
    <section className="section faq" id="faq">
      <div className="wrap faq-grid">
        <div>
          <p className="eyebrow">
            <span className="dash"></span>Перед занятием
          </p>
          <h2>Частые вопросы</h2>
        </div>
        <div>
          <details>
            <summary>
              Можно ли начать с нуля?
              <svg
                className="icon"
                aria-hidden="true"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M4 12h16m-8-8v16" />
              </svg>
            </summary>
            <p>
              Да. На пробном уроке преподаватель определит, какие темы уже
              понятны и с чего стоит начать.
            </p>
          </details>
          <details>
            <summary>
              Что будет на пробном уроке?
              <svg
                className="icon"
                aria-hidden="true"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M4 12h16m-8-8v16" />
              </svg>
            </summary>
            <p>
              Познакомимся, решим несколько заданий и обсудим план подготовки.
              Пробный урок платный. Стоимость можно уточнить у преподавателя.
            </p>
          </details>
          <details>
            <summary>
              Будут ли домашние задания?
              <svg
                className="icon"
                aria-hidden="true"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M4 12h16m-8-8v16" />
              </svg>
            </summary>
            <p>
              Да. После занятия ученик получает задачи, чтобы закрепить тему.
              Вопросы и ошибки разбираем вместе.
            </p>
          </details>
          <details>
            <summary>
              Как выбрать программу подготовки?
              <svg
                className="icon"
                aria-hidden="true"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M4 12h16m-8-8v16" />
              </svg>
            </summary>
            <p>
              Для последовательного старта есть «ОГЭ с нуля», для повторения —
              интенсив. На индивидуальных занятиях можно сосредоточиться на
              конкретной теме.
            </p>
          </details>
        </div>
      </div>
    </section>
  );
}
export default function App() {
  return (
    <>
      <a className="skip" href="#main">
        К содержанию
      </a>
      <Header />
      <main id="main">
        <Hero />
        <Program />
        <Method />
        <Schedule />
        <Faq />
      </main>
      <footer id="contacts">
        <div className="wrap footer-inner">
          <a className="brand" href="#top" aria-label="LAMARUM, в начало">
            <img width="42" height="42" src="/brand/mark.svg" alt="" />
            <span>LAMARUM</span>
          </a>
          <address>
            <a href="mailto:ruslannz00@mail.ru">ruslannz00@mail.ru</a>
            <a href="https://t.me/ruslannzz">Telegram @ruslannzz</a>
          </address>
          <div className="footer-links">
            <a href="privacy.html">Политика обработки данных</a>
          </div>
        </div>
      </footer>
    </>
  );
}
