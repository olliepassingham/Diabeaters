export interface ClinicalWarning {
  message: string;
  severity: "info" | "warning";
}

export function validateTDD(value: string): ClinicalWarning | null {
  const num = parseFloat(value);
  if (!value || isNaN(num) || num <= 0) return null;

  if (num < 5) {
    return { message: "That's unusually low — most adults use between 15-80 units per day", severity: "warning" };
  }
  if (num > 150) {
    return { message: "That's unusually high — most adults use between 15-80 units per day", severity: "warning" };
  }
  return null;
}

export function validateCarbRatio(gramsPerUnit: number | null): ClinicalWarning | null {
  if (!gramsPerUnit || gramsPerUnit <= 0) return null;

  if (gramsPerUnit < 2) {
    return { message: "That ratio seems very strong — most people are between 5g and 25g per unit", severity: "warning" };
  }
  if (gramsPerUnit > 50) {
    return { message: "That ratio seems very sensitive — most people are between 5g and 25g per unit", severity: "warning" };
  }
  return null;
}

export function validateCorrectionFactor(value: string, bgUnit: string): ClinicalWarning | null {
  const num = parseFloat(value);
  if (!value || isNaN(num) || num <= 0) return null;

  if (bgUnit === "mmol/L") {
    if (num < 0.5) {
      return { message: "That's unusually aggressive — most correction factors are between 1 and 6 mmol/L", severity: "warning" };
    }
    if (num > 10) {
      return { message: "That's unusually sensitive — most correction factors are between 1 and 6 mmol/L", severity: "warning" };
    }
  } else {
    if (num < 10) {
      return { message: "That's unusually aggressive — most correction factors are between 20 and 100 mg/dL", severity: "warning" };
    }
    if (num > 150) {
      return { message: "That's unusually sensitive — most correction factors are between 20 and 100 mg/dL", severity: "warning" };
    }
  }
  return null;
}

export function validateTargetBgLow(value: string, bgUnit: string): ClinicalWarning | null {
  const num = parseFloat(value);
  if (!value || isNaN(num) || num <= 0) return null;

  if (bgUnit === "mmol/L") {
    if (num < 3.0) {
      return { message: "A target below 3.0 is dangerously low — most targets start at 4.0 or above", severity: "warning" };
    }
    if (num > 8.0) {
      return { message: "That's unusually high for a lower target — most people aim for 4.0-6.0", severity: "warning" };
    }
  } else {
    if (num < 54) {
      return { message: "A target below 54 is dangerously low — most targets start at 70 or above", severity: "warning" };
    }
    if (num > 144) {
      return { message: "That's unusually high for a lower target — most people aim for 70-110", severity: "warning" };
    }
  }
  return null;
}

export function validateTargetBgHigh(value: string, bgUnit: string): ClinicalWarning | null {
  const num = parseFloat(value);
  if (!value || isNaN(num) || num <= 0) return null;

  if (bgUnit === "mmol/L") {
    if (num < 4.0) {
      return { message: "An upper target of less than 4.0 is very tight — most upper targets are 7.0-10.0", severity: "warning" };
    }
    if (num > 15.0) {
      return { message: "An upper target above 15.0 is unusually high — most people aim for 7.0-10.0", severity: "warning" };
    }
  } else {
    if (num < 72) {
      return { message: "An upper target of less than 72 is very tight — most upper targets are 126-180", severity: "warning" };
    }
    if (num > 270) {
      return { message: "An upper target above 270 is unusually high — most people aim for 126-180", severity: "warning" };
    }
  }
  return null;
}

export function validateTargetRange(low: string, high: string): ClinicalWarning | null {
  const lowNum = parseFloat(low);
  const highNum = parseFloat(high);
  if (!low || !high || isNaN(lowNum) || isNaN(highNum)) return null;

  if (lowNum >= highNum) {
    return { message: "Your lower target should be less than your upper target", severity: "warning" };
  }
  return null;
}
