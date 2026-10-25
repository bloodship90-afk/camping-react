export function backupJSON(reservations, now = new Date()) {
  return JSON.stringify(
    {
      format: "camping-react-backup",
      version: 1,
      exportedAt: now.toISOString(),
      reservations,
    },
    null,
    2,
  );
}
export function reservationsCSV(reservations) {
  const columns = [
    "key",
    "reservationId",
    "name",
    "site",
    "checkin",
    "nights",
    "phone",
    "platform",
    "status",
    "cancelledAt",
  ];
  const cell = (value) => {
    let str = String(value ?? "");
    // Spreadsheet imports must not interpret customer text as a formula.
    if (/^[=+\-@\t\r]/.test(str)) str = "'" + str;
    return '"' + str.replace(/"/g, '""') + '"';
  };
  return (
    "\uFEFF" +
    [
      columns,
      ...Object.entries(reservations || {}).map(([key, r]) =>
        columns.map((c) => (c === "key" ? key : r?.[c])),
      ),
    ]
      .map((row) => row.map(cell).join(","))
      .join("\r\n")
  );
}
export function downloadFile(content, name, type) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
