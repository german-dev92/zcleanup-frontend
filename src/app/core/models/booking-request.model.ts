export interface BookingRequest {
  name: string;
  email: string;
  address: string;
  cleaningType: string;
  homeSize: number;
  desiredDate: string;
  desiredTime: string;
}

export interface BookingResponse {
  success: boolean;
  message: string;
  bookingId?: string;
}
