"use client";

import { useState } from "react";
import {
  appointmentBounds,
  appointmentCount,
  duplicateDateMessage,
  preferredArrivalHelp,
  windowsForDate,
  type AppointmentFieldErrors,
} from "@/lib/appointments";

const fieldClass =
  "w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-base text-slate-900 outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-navy";

type Row = { date: string; windowId: string };

const emptyRows: Row[] = Array.from({ length: appointmentCount }, () => ({
  date: "",
  windowId: "",
}));

export function AppointmentFields({
  errors,
  onEdit,
}: {
  errors: AppointmentFieldErrors;
  onEdit?: () => void;
}) {
  const bounds = appointmentBounds();
  const [rows, setRows] = useState<Row[]>(emptyRows);

  function updateRow(index: number, next: Row) {
    setRows((current) => current.map((row, rowIndex) => (rowIndex === index ? next : row)));
    onEdit?.();
  }

  const duplicateMessage = duplicateDateMessage(rows.map((row) => row.date)) || errors.options;

  return (
    <fieldset className="space-y-4" aria-describedby={duplicateMessage ? "options-error" : undefined}>
      <legend className="text-sm font-semibold text-slate-800">Preferred arrival times</legend>
      <p className="text-sm text-slate-600">{preferredArrivalHelp}</p>
      {duplicateMessage ? (
        <p id="options-error" className="text-sm font-medium text-red-700">
          {duplicateMessage}
        </p>
      ) : null}
      <div className="space-y-5">
        {rows.map((row, index) => {
          const number = index + 1;
          const dateId = `option${number}-date`;
          const dateErrorId = `option${number}Date-error`;
          const windowErrorId = `option${number}Window-error`;
          const dateError = errors[`option${number}Date` as keyof AppointmentFieldErrors];
          const windowError = errors[`option${number}Window` as keyof AppointmentFieldErrors];
          const windows = windowsForDate(row.date);

          return (
            <div key={number} className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm font-semibold text-slate-900">Preferred option {number}</p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <label htmlFor={dateId} className="block text-sm font-semibold text-slate-800">
                    Date
                  </label>
                  <input
                    id={dateId}
                    name={`option${number}Date`}
                    type="date"
                    required
                    min={bounds.min}
                    max={bounds.max}
                    value={row.date}
                    aria-invalid={dateError ? true : undefined}
                    aria-describedby={dateError ? dateErrorId : undefined}
                    className={fieldClass}
                    onChange={(event) => {
                      const date = event.target.value;
                      const stillValid = windowsForDate(date).some((window) => window.id === row.windowId);
                      updateRow(index, { date, windowId: stillValid ? row.windowId : "" });
                    }}
                  />
                  {dateError ? (
                    <p id={dateErrorId} className="text-sm font-medium text-red-700">
                      {dateError}
                    </p>
                  ) : null}
                </div>
                  <fieldset
                    className="space-y-2"
                    aria-invalid={windowError ? true : undefined}
                    aria-describedby={windowError ? windowErrorId : undefined}
                  >
                  <legend className="text-sm font-semibold text-slate-800">Arrival window</legend>
                  {row.date ? (
                    <div className="flex flex-wrap gap-2">
                      {windows.map((window) => {
                        const windowInputId = `option${number}-window-${window.id}`;
                        return (
                          <label
                            key={window.id}
                            htmlFor={windowInputId}
                            className={`inline-flex min-h-11 cursor-pointer items-center rounded-xl border px-3 py-2 text-base has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-brand-navy ${
                              row.windowId === window.id
                                ? "border-brand-navy bg-white font-semibold text-brand-navy"
                                : "border-slate-300 bg-white text-slate-800"
                            }`}
                          >
                            <input
                              id={windowInputId}
                              className="sr-only"
                              type="radio"
                              name={`option${number}Window`}
                              value={window.id}
                              required
                              checked={row.windowId === window.id}
                              onChange={() => updateRow(index, { date: row.date, windowId: window.id })}
                            />
                            {window.label}
                          </label>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-sm text-slate-600">Choose a date first.</p>
                  )}
                  {windowError ? (
                    <p id={windowErrorId} className="text-sm font-medium text-red-700">
                      {windowError}
                    </p>
                  ) : null}
                </fieldset>
              </div>
            </div>
          );
        })}
      </div>
    </fieldset>
  );
}
