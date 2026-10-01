// Shared responsive width for every screen's outer shell (customer, waiter,
// kitchen) so they all grow together across phone / tablet / desktop. It
// intentionally goes full-bleed on tablets and desktops — these are kiosks
// mounted at the table or on the wall, not phone apps — and only caps on
// very large/ultra-wide monitors.
export const SHELL_WIDTH = 'w-full 2xl:max-w-[1680px]'
