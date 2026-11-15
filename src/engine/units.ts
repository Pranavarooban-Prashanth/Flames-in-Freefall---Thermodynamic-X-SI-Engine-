/**
 * Canonical SI unit conversion & header/unit discovery utilities.
 * All internal inference operates strictly in canonical SI/PSI units:
 *   O2_mole_fraction: [0, 1]
 *   total_pressure_kPa: kPa
 *   gravity_level_g: g (Earth = 1.0 g = 9.80665 m/s^2)
 *   ambient_flow_velocity_cm_s: cm/s
 *   characteristic_size_mm / extinction_diameter_mm: mm
 *   peak_temperature_K: K
 */

export const GRAVITY_EARTH_M_S2 = 9.80665;
export const KPA_PER_ATM = 101.325;
export const KPA_PER_PSI = 6.894757;
export const MM_PER_INCH = 25.4;
export const CM_S_PER_FT_MIN = 0.508;

export function o2PercentToMoleFraction(pct: number): number {
  if (!Number.isFinite(pct)) return 0.21;
  return Math.max(0, Math.min(1, pct / 100));
}

export function o2MoleFractionToPercent(x: number): number {
  if (!Number.isFinite(x)) return 21;
  return Math.max(0, Math.min(100, x * 100));
}

export function pressureToKPa(value: number, unit: 'kPa' | 'atm' | 'psi' | 'bar' | 'Pa'): number {
  if (!Number.isFinite(value)) return 101.325;
  switch (unit) {
    case 'kPa':
      return value;
    case 'atm':
      return value * KPA_PER_ATM;
    case 'psi':
      return value * KPA_PER_PSI;
    case 'bar':
      return value * 100;
    case 'Pa':
      return value * 0.001;
  }
}

export function kPaToUnit(kpa: number, unit: 'kPa' | 'atm' | 'psi'): number {
  if (!Number.isFinite(kpa)) return 0;
  switch (unit) {
    case 'kPa':
      return kpa;
    case 'atm':
      return kpa / KPA_PER_ATM;
    case 'psi':
      return kpa / KPA_PER_PSI;
  }
}

export function gravityToG(value: number, unit: 'g' | 'm/s2' | 'mg'): number {
  if (!Number.isFinite(value)) return 0.0001;
  switch (unit) {
    case 'g':
      return value;
    case 'm/s2':
      return value / GRAVITY_EARTH_M_S2;
    case 'mg':
      return value / 1000;
  }
}

export function gToMS2(g: number): number {
  return g * GRAVITY_EARTH_M_S2;
}

export function velocityToCmS(value: number, unit: 'cm/s' | 'mm/s' | 'm/s' | 'ft/min'): number {
  if (!Number.isFinite(value)) return 0;
  switch (unit) {
    case 'cm/s':
      return value;
    case 'mm/s':
      return value / 10;
    case 'm/s':
      return value * 100;
    case 'ft/min':
      return value * CM_S_PER_FT_MIN;
  }
}

export function cmSToFtMin(cms: number): number {
  return cms / CM_S_PER_FT_MIN;
}

export function lengthToMm(value: number, unit: 'mm' | 'cm' | 'um' | 'in'): number {
  if (!Number.isFinite(value)) return 0;
  switch (unit) {
    case 'mm':
      return value;
    case 'cm':
      return value * 10;
    case 'um':
      return value / 1000;
    case 'in':
      return value * MM_PER_INCH;
  }
}

export function mmToInches(mm: number): number {
  return mm / MM_PER_INCH;
}

export function temperatureToKelvin(value: number, unit: 'K' | 'C' | 'F'): number {
  if (!Number.isFinite(value)) return 295;
  switch (unit) {
    case 'K':
      return value;
    case 'C':
      return value + 273.15;
    case 'F':
      return ((value - 32) * 5) / 9 + 273.15;
  }
}

export function kelvinToFahrenheit(k: number): number {
  return ((k - 273.15) * 9) / 5 + 32;
}

export function kelvinToCelsius(k: number): number {
  return k - 273.15;
}
