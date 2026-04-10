"use server";

export type ShipmentActionState = {
  success: boolean;
  error?: string;
  errorCode?: string;
};
