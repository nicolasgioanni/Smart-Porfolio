import { reserveContactSubmission } from "../../functions/_shared/contact/reservation";
import type { ContactEnv, ContactPayload } from "../../functions/_shared/contact/contracts";

export default {
  async fetch(request: Request, env: ContactEnv): Promise<Response> {
    const { id, email, ip, now } = await request.json() as { id: string; email: string; ip: string; now: number };
    const payload: ContactPayload = {
      submissionId: id, firstName: "Avery", lastName: "Nguyen", email, phone: "", message: "Hello",
      contactConsent: true, legalConsent: true, startedAt: 1, website: ""
    };
    return Response.json(await reserveContactSubmission(payload, env, ip, now));
  }
};
