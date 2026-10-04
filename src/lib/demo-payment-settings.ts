import { z } from "zod";

export const demoPaymentMethodsSchema = z.object({
  cash: z.boolean().default(true),
  upi: z.boolean().default(true),
  razorpay: z.boolean().default(false),
  stripe: z.boolean().default(false),
});
export type DemoPaymentMethod = keyof z.infer<typeof demoPaymentMethodsSchema>;
export function readDemoPaymentMethods(storage: Pick<Storage, "getItem"> = localStorage) {
  try {
    return demoPaymentMethodsSchema.parse(
      JSON.parse(storage.getItem("pgone.demo.payment-methods.v1") ?? "{}"),
    );
  } catch {
    return demoPaymentMethodsSchema.parse({});
  }
}
export function saveDemoPaymentMethods(methods: z.infer<typeof demoPaymentMethodsSchema>) {
  localStorage.setItem(
    "pgone.demo.payment-methods.v1",
    JSON.stringify(demoPaymentMethodsSchema.parse(methods)),
  );
}
