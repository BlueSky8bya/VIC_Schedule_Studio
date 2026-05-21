import type { PublicSchedule } from "@/lib/domain/schedule-types";

type PublicPosterProps = {
  schedule: PublicSchedule;
};

export function PublicPoster({ schedule }: PublicPosterProps) {
  const days = buildMonthDays(schedule.calendar.month);

  return (
    <main className="poster-page">
      <section className="poster-surface" data-export-surface>
        <header className="poster-header">
          <div>
            <p className="eyebrow">KST Monthly Poster</p>
            <h1>{schedule.calendar.displayName}</h1>
          </div>
          <div className="poster-month">{schedule.calendar.month}</div>
        </header>

        <div className="poster-grid" aria-label="Monthly public schedule">
          {days.map((day) => {
            const events = schedule.events.filter((event) =>
              event.startsAt.startsWith(day.isoDate)
            );

            return (
              <article className="poster-day" key={day.isoDate}>
                <span className="poster-date">{day.dayOfMonth}</span>
                <div className="poster-events">
                  {events.map((event) => (
                    <div className={`poster-event ${event.category}`} key={event.id}>
                      <strong>{event.publicTitle}</strong>
                      <span>
                        {formatTime(event.startsAt)} - {formatTime(event.endsAt)}
                      </span>
                    </div>
                  ))}
                </div>
              </article>
            );
          })}
        </div>

        <footer className="poster-footer">
          <span>Asia/Seoul</span>
          {schedule.supportCampaigns.map((campaign) => (
            <a href={campaign.url} key={campaign.id}>
              {campaign.label}
            </a>
          ))}
        </footer>
      </section>
    </main>
  );
}

function buildMonthDays(month: string) {
  const [year, monthNumber] = month.split("-").map(Number);
  const lastDate = new Date(year, monthNumber, 0).getDate();

  return Array.from({ length: lastDate }, (_, index) => {
    const dayOfMonth = index + 1;
    return {
      dayOfMonth,
      isoDate: `${month}-${String(dayOfMonth).padStart(2, "0")}`
    };
  });
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Seoul"
  }).format(new Date(value));
}
