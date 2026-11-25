// frontend/src/pages/Farm.tsx
//
// The farmer's own land book and spray calendar.
//
// `farmApi` covers lands (orchard / farmland / greenhouse), a per-land calendar
// of spraying, fertilising and irrigation, and consultation requests — and no
// screen used a line of it. The demo farmer has two lands and a calendar with
// finished and planned operations; a real farmer had nowhere to record either,
// and the site's own copy («مشاورهٔ کارشناس — برنامهٔ کود و سم») pointed at a
// service whose tooling did not exist.
//
// Shape of the page:
//   • Lands first, because everything else hangs off one.
//   • The calendar is shown as one list with the date as the spine — a farmer
//     reads «what is due, and what did I already do», not a month grid on a
//     phone in a field.
//   • Areas and dates come back as strings; they are printed exactly as the
//     server formatted them (`area_label`), never re-parsed in the browser. A
//     Jalali date is not a `Date`, and formatting one locally is how a spraying
//     date ends up a day off.

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarDays, MapPin, MessageSquare, Sprout, Trash2 } from 'lucide-react';

import { farmApi } from '../api/services';
import type { FarmLandPayload, FarmEventPayload } from '../api/services';
import type { FarmCalendarEvent, FarmLand } from '@/types/farming';
import { parseApiError } from '../api/errors';
import { cn } from '../lib/cn';
import { nums } from '../lib/price';
import { date as formatDate, dateTime } from '../lib/date';
import { useAuthStore } from '../store/authStore';
import { useTitle } from '../lib/useTitle';
import PageHead from '../components/shop/PageHead';
import { LocationFields } from '../components/shop/LocationFields';
import Button from '../components/ui/Button';
import EmptyState from '../components/ui/EmptyState';
import { SelectField, TextArea, TextField } from '../components/ui/Field';
import { Skeleton } from '../components/ui/Skeleton';

const LAND_TYPES: Array<{ value: FarmLand['land_type']; label: string }> = [
  { value: 'orchard', label: 'باغ' },
  { value: 'farmland', label: 'زمین زراعی' },
  { value: 'greenhouse', label: 'گلخانه' },
];

const EVENT_KINDS: Array<{ value: FarmCalendarEvent['kind']; label: string }> = [
  { value: 'spraying', label: 'سم‌پاشی' },
  { value: 'fertilizing', label: 'کوددهی' },
  { value: 'irrigation', label: 'آبیاری' },
];

// Mirrors FarmConsultationRequest.SUBJECT_CHOICES on the backend.
const SUBJECTS = [
  { value: 'general', label: 'مشاوره عمومی' },
  { value: 'spraying', label: 'مشاوره سم‌پاشی' },
  { value: 'fertilizing', label: 'مشاوره کوددهی' },
  { value: 'irrigation', label: 'مشاوره آبیاری' },
  { value: 'pest', label: 'آفت و بیماری' },
];

// Mirrors FarmLand.AREA_UNIT_CHOICES — «جریب» was missing, and a land
// registered in jarib could not be edited without silently changing its unit.
const AREA_UNITS = [
  { value: 'hectare', label: 'هکتار' },
  { value: 'jarib', label: 'جریب' },
  { value: 'square_meter', label: 'مترمربع' },
];

function LandForm({ land, onDone }: { land?: FarmLand; onDone: () => void }) {
  const queryClient = useQueryClient();
  const [name, setName] = useState(land?.name ?? '');
  const [landType, setLandType] = useState<FarmLand['land_type']>(land?.land_type ?? 'farmland');
  const [area, setArea] = useState(land?.area ?? '');
  const [areaUnit, setAreaUnit] = useState(land?.area_unit ?? 'hectare');
  const [crop, setCrop] = useState(land?.crop_type ?? '');
  const [province, setProvince] = useState(land?.province ?? '');
  const [city, setCity] = useState(land?.city ?? '');

  const create = useMutation({
    mutationFn: async () => {
      const payload: FarmLandPayload = {
        name: name.trim(),
        land_type: landType,
        area: area.trim(),
        area_unit: areaUnit,
        crop_type: crop.trim(),
        province: province.trim(),
        city: city.trim(),
      };
      // A land with a typo in its area stayed wrong forever: the page could
      // create one and never correct or remove it, though `updateLand` and
      // `deleteLand` were both served.
      return land
        ? (await farmApi.updateLand(land.id, payload)).data
        : (await farmApi.createLand(payload)).data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['farm-lands'] });
      void queryClient.invalidateQueries({ queryKey: ['farm-calendar'] });
      onDone();
    },
  });

  return (
    <form
      noValidate
      className="mt-3 flex flex-col gap-3 rounded-lg border border-line p-4 dark:border-night-line"
      onSubmit={(event) => {
        event.preventDefault();
        if (!name.trim() || !area.trim() || create.isPending) return;
        create.mutate();
      }}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <TextField
          label="نام زمین"
          required
          value={name}
          onChange={(event) => setName(event.target.value)}
          hint="مثلاً: باغ سیب کرج"
        />
        <SelectField
          label="نوع"
          value={landType}
          onChange={(event) => setLandType(event.target.value as FarmLand['land_type'])}
        >
          {LAND_TYPES.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </SelectField>
        <div className="grid grid-cols-2 gap-2">
          <TextField
            label="مساحت"
            required
            dir="ltr"
            inputMode="decimal"
            value={area}
            onChange={(event) => setArea(event.target.value)}
          />
          <SelectField label="واحد" value={areaUnit} onChange={(event) => setAreaUnit(event.target.value)}>
            {AREA_UNITS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </SelectField>
        </div>
        <TextField
          label="محصول"
          required
          value={crop}
          onChange={(event) => setCrop(event.target.value)}
          hint="مثلاً: گندم، سیب، خیار"
        />
        {/* The province on a land is reported to the consultant and to the
            service desk, and is copied onto a service request when that form
            leaves it blank — so it has to be a real one. */}
        <LocationFields
          province={province}
          city={city}
          onChange={({ province: next, city: nextCity }) => {
            setProvince(next);
            setCity(nextCity);
          }}
        />
      </div>

      {create.isError && (
        <p role="alert" className="text-2xs font-bold text-danger-700">
          {parseApiError(create.error).message}
        </p>
      )}

      <div className="flex items-center gap-2">
        <Button type="submit" loading={create.isPending}>
          {land ? 'ذخیرهٔ تغییرات' : 'ثبت زمین'}
        </Button>
        <Button type="button" variant="quiet" onClick={onDone}>
          انصراف
        </Button>
      </div>
    </form>
  );
}

function EventForm({ lands, onDone }: { lands: FarmLand[]; onDone: () => void }) {
  const queryClient = useQueryClient();
  const [landId, setLandId] = useState(String(lands[0]?.id ?? ''));
  const [kind, setKind] = useState<FarmCalendarEvent['kind']>('spraying');
  const [title, setTitle] = useState('');
  const [when, setWhen] = useState('');

  const create = useMutation({
    mutationFn: async () => {
      const payload: FarmEventPayload = {
        kind,
        title: title.trim(),
        // The API takes a Gregorian ISO date; the field is type=date so the
        // browser hands us exactly that.
        date: when,
        status: 'planned',
      };
      return (await farmApi.addEvent(Number(landId), payload)).data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['farm-calendar'] });
      void queryClient.invalidateQueries({ queryKey: ['farm-lands'] });
      onDone();
    },
  });

  return (
    <form
      noValidate
      className="mt-3 flex flex-col gap-3 rounded-lg border border-line p-4 dark:border-night-line"
      onSubmit={(event) => {
        event.preventDefault();
        if (!title.trim() || !when || create.isPending) return;
        create.mutate();
      }}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <SelectField label="زمین" value={landId} onChange={(event) => setLandId(event.target.value)}>
          {lands.map((land) => (
            <option key={land.id} value={land.id}>
              {land.name}
            </option>
          ))}
        </SelectField>
        <SelectField
          label="نوع عملیات"
          value={kind}
          onChange={(event) => setKind(event.target.value as FarmCalendarEvent['kind'])}
        >
          {EVENT_KINDS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </SelectField>
        <TextField
          label="عنوان"
          required
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          hint="مثلاً: سم‌پاشی علیه شته"
        />
        <TextField
          label="تاریخ"
          required
          type="date"
          dir="ltr"
          value={when}
          onChange={(event) => setWhen(event.target.value)}
        />
      </div>

      {create.isError && (
        <p role="alert" className="text-2xs font-bold text-danger-700">
          {parseApiError(create.error).message}
        </p>
      )}

      <div className="flex items-center gap-2">
        <Button type="submit" loading={create.isPending}>
          افزودن به تقویم
        </Button>
        <Button type="button" variant="quiet" onClick={onDone}>
          انصراف
        </Button>
      </div>
    </form>
  );
}

/**
 * Filing a consultation.
 *
 * `createConsultation` was the one method of `farmApi` nothing called, and the
 * gap it left was a promise the product makes twice: the levels ladder tells
 * every level-1 buyer they can «درخواست مشاوره کشاورزی», and the services page
 * sells «مشاورهٔ زراعت». Neither had a form.
 *
 * A request is always attached to a land, because the answer depends on the
 * crop, the soil and the province — a free-text box with no land behind it
 * cannot be answered, only acknowledged.
 */
function ConsultationForm({ lands, onDone }: { lands: FarmLand[]; onDone: () => void }) {
  const queryClient = useQueryClient();
  const [landId, setLandId] = useState(String(lands[0]?.id ?? ''));
  const [subject, setSubject] = useState('general');
  const [message, setMessage] = useState('');

  const create = useMutation({
    mutationFn: async () =>
      (
        await farmApi.createConsultation({
          land_id: Number(landId),
          subject,
          message: message.trim(),
        })
      ).data,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['farm-consultations'] });
      onDone();
    },
  });

  return (
    <form
      noValidate
      className="mt-3 flex flex-col gap-3 rounded-lg border border-line p-4 dark:border-night-line"
      onSubmit={(event) => {
        event.preventDefault();
        if (!message.trim() || create.isPending) return;
        create.mutate();
      }}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <SelectField label="زمین" value={landId} onChange={(event) => setLandId(event.target.value)}>
          {lands.map((land) => (
            <option key={land.id} value={land.id}>
              {land.name}
            </option>
          ))}
        </SelectField>
        <SelectField label="موضوع" value={subject} onChange={(event) => setSubject(event.target.value)}>
          {SUBJECTS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </SelectField>
      </div>

      <TextArea
        label="چه می‌خواهید بدانید؟"
        required
        rows={4}
        value={message}
        onChange={(event) => setMessage(event.target.value)}
        hint="محصول، مرحلهٔ رشد و آنچه تا حالا انجام داده‌اید را بنویسید تا پاسخ دقیق باشد."
      />

      {create.isError && (
        <p role="alert" className="text-2xs font-bold text-danger-700">
          {parseApiError(create.error).message}
        </p>
      )}

      <div className="flex items-center gap-2">
        <Button type="submit" loading={create.isPending}>
          ارسال درخواست
        </Button>
        <Button type="button" variant="quiet" onClick={onDone}>
          انصراف
        </Button>
      </div>
    </form>
  );
}

export default function Farm() {
  useTitle('زمین‌ها و تقویم کشت');
  const user = useAuthStore((state) => state.user);
  const queryClient = useQueryClient();
  const [addingLand, setAddingLand] = useState(false);
  const [editingLand, setEditingLand] = useState<FarmLand | null>(null);
  const [addingEvent, setAddingEvent] = useState(false);
  const [askingConsult, setAskingConsult] = useState(false);

  const lands = useQuery({
    queryKey: ['farm-lands'],
    queryFn: async () => (await farmApi.lands()).data,
    enabled: Boolean(user),
  });

  const calendar = useQuery({
    queryKey: ['farm-calendar'],
    queryFn: async () => (await farmApi.calendar()).data,
    enabled: Boolean(user),
  });

  const consultations = useQuery({
    queryKey: ['farm-consultations'],
    queryFn: async () => (await farmApi.consultations()).data,
    enabled: Boolean(user),
  });

  const removeLand = useMutation({
    mutationFn: async (landId: number) => (await farmApi.deleteLand(landId)).data,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['farm-lands'] });
      void queryClient.invalidateQueries({ queryKey: ['farm-calendar'] });
      void queryClient.invalidateQueries({ queryKey: ['farm-consultations'] });
    },
  });

  const removeEvent = useMutation({
    mutationFn: async (eventId: number) => (await farmApi.deleteEvent(eventId)).data,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['farm-calendar'] });
      void queryClient.invalidateQueries({ queryKey: ['farm-lands'] });
    },
  });

  const complete = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: FarmCalendarEvent['status'] }) =>
      (await farmApi.updateEvent(id, { status })).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['farm-calendar'] }),
  });

  if (!user) {
    return (
      <div className="shell py-16">
        <EmptyState
          icon={Sprout}
          title="برای دیدن زمین‌ها و تقویم کشت وارد شوید"
          description="زمین، تاریخ کاشت و عملیات سم‌پاشی و کوددهی زیر همین حساب ذخیره می‌شود."
          action={
            <Button to="/login" size="sm">
              ورود
            </Button>
          }
        />
      </div>
    );
  }

  const landList: FarmLand[] = lands.data ?? [];
  const events: FarmCalendarEvent[] = calendar.data ?? [];
  const requests = consultations.data ?? [];

  // Planned first, then by date: what is due is the question a farmer opens
  // this page to answer.
  const sorted = [...events].sort((a, b) => {
    if (a.status !== b.status) return a.status === 'planned' ? -1 : 1;
    return a.date.localeCompare(b.date); // ISO dates sort lexicographically
  });

  return (
    <div className="shell flex flex-col gap-6 py-8">
      <PageHead
        title="زمین‌ها و تقویم کشت"
        lead="هر زمین با محصول و مساحتش، و هر عملیات سم‌پاشی، کوددهی و آبیاری با تاریخش — تا بدانید چه گذشته و چه مانده است."
        actions={
          landList.length > 0 ? (
            <Button size="sm" onClick={() => setAddingEvent(true)} icon={CalendarDays}>
              افزودن به تقویم
            </Button>
          ) : undefined
        }
      />

      <section aria-labelledby="lands-title">
        <div className="flex items-center justify-between">
          <h2 id="lands-title" className="text-sm font-extrabold text-ink dark:text-white">
            زمین‌های من
          </h2>
          <Button variant="secondary" size="sm" onClick={() => setAddingLand(true)}>
            ثبت زمین
          </Button>
        </div>

        {addingLand && <LandForm onDone={() => setAddingLand(false)} />}
        {editingLand && <LandForm land={editingLand} onDone={() => setEditingLand(null)} />}

        {lands.isLoading ? (
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <Skeleton className="h-24 rounded-lg" />
            <Skeleton className="h-24 rounded-lg" />
          </div>
        ) : landList.length === 0 ? (
          <p className="mt-3 rounded-lg border border-line p-4 text-2xs leading-6 text-ink-mute dark:border-night-line dark:text-white/50">
            هنوز زمینی ثبت نکرده‌اید. با ثبت زمین، تقویم عملیات و درخواست مشاوره برای همان زمین ممکن
            می‌شود.
          </p>
        ) : (
          <ul className="mt-3 grid gap-3 sm:grid-cols-2">
            {landList.map((land) => (
              <li
                key={land.id}
                className="rounded-lg border border-line bg-paper p-4 dark:border-night-line dark:bg-night-soft"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs font-extrabold text-ink dark:text-white">{land.name}</p>
                    <p className="mt-0.5 text-2xs text-ink-mute dark:text-white/50">
                      {land.land_type_label} · {land.area_label} · {land.crop_type}
                      {land.crop_variety && ` (${land.crop_variety})`}
                    </p>
                  </div>
                  <span className="dateline shrink-0 rounded-sm bg-brand-50 px-1.5 py-0.5 text-[11px] font-bold text-brand-800 dark:bg-night dark:text-brand-300">
                    {nums(land.event_count)} عملیات
                  </span>
                </div>
                <div className="mt-2 flex items-center justify-between gap-2">
                  {(land.province || land.city) && (
                    <p className="flex items-center gap-1 text-[11px] text-ink-mute dark:text-white/40">
                      <MapPin size={11} aria-hidden="true" />
                      {[land.province, land.city].filter(Boolean).join('، ')}
                    </p>
                  )}
                  <span className="ms-auto flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setEditingLand(land)}
                      className="text-[11px] font-bold text-brand-700 hover:underline dark:text-brand-300"
                    >
                      ویرایش
                    </button>
                    {/* Deleting a land is not offered while it still has
                        operations or consultations behind it in the list — the
                        calendar is the reason to keep the record. */}
                    {land.event_count === 0 && (
                      <button
                        type="button"
                        onClick={() => removeLand.mutate(land.id)}
                        disabled={removeLand.isPending}
                        aria-label={`حذف ${land.name}`}
                        className="text-ink-mute hover:text-danger-700 disabled:opacity-50 dark:text-white/40"
                      >
                        <Trash2 size={12} aria-hidden="true" />
                      </button>
                    )}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {addingEvent && (
        <EventForm
          lands={landList}
          onDone={() => setAddingEvent(false)}
        />
      )}

      <section aria-labelledby="calendar-title">
        <h2 id="calendar-title" className="text-sm font-extrabold text-ink dark:text-white">
          تقویم عملیات
        </h2>

        {calendar.isLoading ? (
          <div className="mt-3 flex flex-col gap-2">
            <Skeleton className="h-14" />
            <Skeleton className="h-14" />
          </div>
        ) : sorted.length === 0 ? (
          <p className="mt-3 rounded-lg border border-line p-4 text-2xs leading-6 text-ink-mute dark:border-night-line dark:text-white/50">
            تقویم خالی است. اولین عملیات را اضافه کنید تا تاریخش اینجا بماند.
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-line dark:divide-night-line">
            {sorted.map((event) => (
              <li key={event.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-bold text-ink dark:text-white">
                    <span className="text-ink-mute dark:text-white/45">{formatDate(event.date)}</span>
                    {event.title}
                    {event.is_consultant_note && (
                      <span className="rounded-sm bg-brand-50 px-1.5 py-0.5 text-[10px] font-bold text-brand-800 dark:bg-night dark:text-brand-300">
                        از مشاور
                      </span>
                    )}
                  </p>
                  <p className="mt-0.5 text-2xs text-ink-mute dark:text-white/45">
                    {event.land_name} · {event.kind_label} · {event.status_label}
                  </p>
                  {event.notes && (
                    <p className="mt-1 text-2xs leading-6 text-ink-soft dark:text-white/60">{event.notes}</p>
                  )}
                </div>

                <span className="flex items-center gap-2">
                  {/* Only a planned operation can be finished. A consultant's
                      note is not the farmer's to close out: the server would
                      accept it (the land is theirs), but marking someone
                      else's advice as done is a claim the farmer cannot make. */}
                  {event.status === 'planned' && !event.is_consultant_note && (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => complete.mutate({ id: event.id, status: 'done' })}
                      loading={complete.isPending}
                    >
                      انجام شد
                    </Button>
                  )}
                  {/* A planned entry the farmer typed wrong — wrong day, wrong
                      land, wrong input — could not be removed at all, though
                      `farmApi.deleteEvent` is served. Kept off a consultant's
                      note for the same reason as «انجام شد»: deleting advice is
                      the consultant's call, and their edit goes through the
                      desk, not this page. */}
                  {event.status === 'planned' && !event.is_consultant_note && (
                    <button
                      type="button"
                      onClick={() => removeEvent.mutate(event.id)}
                      disabled={removeEvent.isPending}
                      aria-label={`حذف ${event.title} از تقویم`}
                      className="text-ink-mute hover:text-danger-700 disabled:opacity-50 dark:text-white/40"
                    >
                      <Trash2 size={13} aria-hidden="true" />
                    </button>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="consults-title">
        <div className="flex items-center justify-between">
          <h2 id="consults-title" className="text-sm font-extrabold text-ink dark:text-white">
            درخواست‌های مشاوره
          </h2>
          {landList.length > 0 ? (
            <Button
              variant="secondary"
              size="sm"
              icon={MessageSquare}
              onClick={() => setAskingConsult(true)}
            >
              درخواست مشاوره
            </Button>
          ) : (
            <span className="text-[11px] text-ink-mute dark:text-white/40">
              برای درخواست مشاوره اول یک زمین ثبت کنید.
            </span>
          )}
        </div>

        {askingConsult && <ConsultationForm lands={landList} onDone={() => setAskingConsult(false)} />}

        {requests.length === 0 ? (
          <p className="mt-3 text-2xs leading-6 text-ink-mute dark:text-white/45">
            درخواست مشاوره‌ای ثبت نکرده‌اید. برای برنامهٔ کود و سم، از صفحهٔ خدمات درخواست بفرستید.
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-line dark:divide-night-line">
            {requests.map((request) => (
              <li key={request.id} className="py-3">
                <p className="flex flex-wrap items-center gap-2 text-xs font-bold text-ink dark:text-white">
                  {request.subject_label}
                  <span
                    className={cn(
                      'rounded-sm px-1.5 py-0.5 text-[10px] font-bold',
                      request.status === 'answered'
                        ? 'bg-brand-50 text-brand-800 dark:bg-night dark:text-brand-300'
                        : 'bg-gold-50 text-gold-700 dark:bg-night dark:text-gold-600',
                    )}
                  >
                    {request.status_label}
                  </span>
                </p>
                <p className="mt-0.5 text-2xs text-ink-mute dark:text-white/45">
                  {request.land?.name} · {dateTime(request.created_at)}
                </p>
                {request.reply && (
                  <p className="mt-1 rounded-sm border-s-2 border-brand-600 bg-brand-50/60 px-2 py-1 text-2xs leading-6 text-ink-soft dark:bg-night-soft dark:text-white/65">
                    {request.reply}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
