export type PromoCode = {
  code: string;
  discountPercent: number;
  used: boolean;
  createdAt: string;
  usedAt?: string;
};

export type Customer = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  dateOfBirth?: string;
  phone: string;
  address: string;
  city: string;
  postalCode: string;
  country: string;
  notes: string;
  loyaltyPoints: number;
  promoCodes: PromoCode[];
  passwordHash: string;
  passwordSalt: string;
  createdAt: string;
};

export type PublicCustomer = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  dateOfBirth?: string;
  phone: string;
  address: string;
  city: string;
  postalCode: string;
  country: string;
  loyaltyPoints: number;
  promoCodes: PromoCode[];
  referralCode?: string;
  referredByCode?: string;
  referralBoundAt?: string;
  referralRewardedAt?: string;
  createdAt: string;
};

export type AdminCustomer = PublicCustomer & {
  notes: string;
};

export type CustomerStore = {
  customers: Customer[];
};
