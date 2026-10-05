import type { Role } from "./demo-data";

export type DemoWhatsappMessage = {
  id: string;
  event: string;
  recipientId: string;
  recipientRole: Role;
  recipientName: string;
  phone: string;
  body: string;
  createdAt: string;
  read: boolean;
};
export type DemoWhatsappState = { enabled: boolean; messages: DemoWhatsappMessage[] };
export type DemoWhatsappInbox = DemoWhatsappState;
