import { create } from "zustand";
import { DEMO_PATIENT } from "./demo-data";

interface PatientData {
  id:         string;
  firstName:  string;
  lastName:   string;
  fullName:   string;
  initials:   string;
  phone:      string;
  dni:        string;
  email:      string;
  birthLabel: string;
  address:    string;
  joinedAt:   string;
  totalVisits: number;
  avatarColor: string;
}

interface AuthState {
  isLoggedIn: boolean;
  patient:    PatientData | null;
  phone:      string;
  // Actions
  setPhone:   (phone: string) => void;
  login:      (phone: string) => void;
  register:   (data: { firstName: string; lastName: string; phone: string; dni?: string }) => void;
  updateProfile: (data: Partial<PatientData>) => void;
  logout:     () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  isLoggedIn: false,
  patient:    null,
  phone:      "",

  setPhone: (phone) => set({ phone }),

  login: (_phone) =>
    set({
      isLoggedIn: true,
      // In demo mode: always load the same patient data
      patient: DEMO_PATIENT,
    }),

  register: (data) =>
    set({
      isLoggedIn: true,
      patient: {
        ...DEMO_PATIENT,
        firstName: data.firstName,
        lastName:  data.lastName,
        fullName:  `${data.firstName} ${data.lastName}`,
        initials:  (data.firstName[0] ?? "").toUpperCase() + (data.lastName[0] ?? "").toUpperCase(),
        phone:     data.phone,
        dni:       data.dni ?? "",
      },
    }),

  updateProfile: (data) =>
    set((state) => ({
      patient: state.patient ? { ...state.patient, ...data } : state.patient,
    })),

  logout: () => set({ isLoggedIn: false, patient: null, phone: "" }),
}));
