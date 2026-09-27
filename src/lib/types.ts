export type Role = 'buyer' | 'shopkeeper' | 'admin';
export type PtaStatus = 'pta_approved' | 'non_pta';
export type PtaPref = PtaStatus | 'any';
export type Condition = 'new' | 'a_plus' | 'a' | 'b' | 'c';
export type ConditionPref = 'new' | 'used' | 'any';
export type RequestStatus = 'active' | 'fulfilled' | 'expired' | 'cancelled';
export type OfferStatus = 'sent' | 'accepted' | 'declined' | 'withdrawn';

export interface Profile {
  id: string;
  full_name: string | null;
  phone: string | null;
  role: Role | null;
}

export interface Market {
  id: string;
  name: string;
  city: string;
}

export interface DeviceModel {
  id: string;
  brand: string;
  model: string;
  storage_options: number[];
  colors: string[];
}

export interface Shop {
  id: string;
  owner_id: string;
  market_id: string;
  name: string;
  floor_label: string;
  wing: string | null;
  stall_number: string;
  landmark: string | null;
  directions: string[];
  phone: string | null;
  is_verified: boolean;
  is_online: boolean;
  rating_avg: number;
  rating_count: number;
}

export interface PhoneRequest {
  id: string;
  buyer_id: string;
  market_id: string;
  device_model_id: string;
  storage_gb: number;
  color: string | null;
  pta_pref: PtaPref;
  condition_pref: ConditionPref;
  min_battery: number;
  budget_min: number;
  budget_max: number;
  status: RequestStatus;
  expires_at: string;
  created_at: string;
  device_models?: DeviceModel;
}

export interface Offer {
  id: string;
  request_id: string;
  shop_id: string;
  stock_item_id: string | null;
  price: number;
  condition: Condition;
  battery_health: number | null;
  pta_status: PtaStatus;
  in_box: string | null;
  notes: string | null;
  photo_path: string | null;
  status: OfferStatus;
  hold_until: string | null;
  created_at: string;
  shops?: Shop;
  requests?: PhoneRequest;
}

export interface StockItem {
  id: string;
  shop_id: string;
  device_model_id: string;
  storage_gb: number;
  color: string | null;
  condition: Condition;
  battery_health: number | null;
  pta_status: PtaStatus;
  price: number;
  in_box: string | null;
  notes: string | null;
  is_available: boolean;
  device_models?: DeviceModel;
}

export interface Visit {
  id: string;
  offer_id: string;
  request_id: string;
  buyer_id: string;
  shop_id: string;
  confirmed_at: string | null;
  shop_outcome: 'sold' | 'no_sale' | null;
  buyer_outcome: 'bought' | 'not_bought' | null;
  final_price: number | null;
  created_at: string;
  offers?: Offer;
  shops?: Shop;
}
