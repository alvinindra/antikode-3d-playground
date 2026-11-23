const paths = {
  arrow: 'M4 12h15m-6-6 6 6-6 6',
  menu: 'M3 7h5m5 0h8M3 17h10m5 0h3M8 4v6m5 4v6',
  close: 'm6 6 12 12M18 6 6 18',
  sun: 'M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0ZM12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M19 5l-1.5 1.5m-11 11L5 19',
  moon: 'M20 14a8 8 0 0 1-10-10 8.5 8.5 0 1 0 10 10Z',
  mouse: 'M5 10a7 7 0 0 1 14 0v5a7 7 0 0 1-14 0Zm7-6v6',
  check: 'm5 12 4.5 4.5L19 7',
};

export function Icon({ name }: { name: keyof typeof paths }) {
  return <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65"
    strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name]} /></svg>;
}

// An axonometric section through the auditorium's tiered seating.
export function RoomMark() {
  return <svg className="room-mark" viewBox="0 0 40 40" fill="none" aria-hidden="true">
    <path d="m3 23 11-6v-5l10-5 13 7v9L17 35 3 28Z" fill="currentColor" />
    <path d="m3 23 14 7 10-6v-5l10-5M14 12l13 7M14 17l8 4.5" stroke="var(--mark-cut, var(--paper))" strokeWidth="1.6" />
  </svg>;
}
