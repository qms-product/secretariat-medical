/**
 * Fictitious data for the medical secretary voice assistant.
 * All data is hardcoded as TypeScript constants per ADR-2.
 * No real patient data is used.
 */

export interface TimeSlot {
  id: string;
  date: string;
  time: string;
  duration: number; // minutes
  doctor: string;
  available: boolean;
  patientName?: string;
}

export interface DoctorInfo {
  name: string;
  specialty: string;
  phone: string;
  office: string;
}

export interface OfficeInfo {
  name: string;
  address: string;
  phone: string;
  openingHours: string;
  doctors: DoctorInfo[];
}

export const OFFICE_INFO: OfficeInfo = {
  name: "Cabinet Medical Fictif Saint-Martin",
  address: "12 Rue de la Sante, 75014 Paris",
  phone: "01 23 45 67 89",
  openingHours: "Lundi-Vendredi 8h00-18h00",
  doctors: [
    {
      name: "Dr. Marie Dupont",
      specialty: "Medecine generale",
      phone: "01 23 45 67 90",
      office: "Bureau 101",
    },
    {
      name: "Dr. Jean Martin",
      specialty: "Dermatologie",
      phone: "01 23 45 67 91",
      office: "Bureau 202",
    },
  ],
};

export const TIME_SLOTS: TimeSlot[] = [
  {
    id: "slot-1",
    date: "2026-06-10",
    time: "09:00",
    duration: 30,
    doctor: "Dr. Marie Dupont",
    available: true,
  },
  {
    id: "slot-2",
    date: "2026-06-10",
    time: "10:00",
    duration: 30,
    doctor: "Dr. Marie Dupont",
    available: false,
    patientName: "Jean Leclerc",
  },
  {
    id: "slot-3",
    date: "2026-06-10",
    time: "11:00",
    duration: 30,
    doctor: "Dr. Marie Dupont",
    available: true,
  },
  {
    id: "slot-4",
    date: "2026-06-10",
    time: "14:00",
    duration: 30,
    doctor: "Dr. Jean Martin",
    available: true,
  },
  {
    id: "slot-5",
    date: "2026-06-10",
    time: "15:00",
    duration: 30,
    doctor: "Dr. Jean Martin",
    available: false,
    patientName: "Sophie Bernard",
  },
  {
    id: "slot-6",
    date: "2026-06-11",
    time: "09:30",
    duration: 30,
    doctor: "Dr. Marie Dupont",
    available: true,
  },
  {
    id: "slot-7",
    date: "2026-06-11",
    time: "10:30",
    duration: 30,
    doctor: "Dr. Marie Dupont",
    available: true,
  },
  {
    id: "slot-8",
    date: "2026-06-11",
    time: "14:00",
    duration: 30,
    doctor: "Dr. Jean Martin",
    available: false,
    patientName: "Pierre Moreau",
  },
  {
    id: "slot-9",
    date: "2026-06-12",
    time: "09:00",
    duration: 30,
    doctor: "Dr. Marie Dupont",
    available: true,
  },
  {
    id: "slot-10",
    date: "2026-06-12",
    time: "16:00",
    duration: 30,
    doctor: "Dr. Jean Martin",
    available: true,
  },
];
