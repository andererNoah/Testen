import type { Principal } from "@hv/access";
import type { Tx } from "@hv/db";
import type { IsoDate } from "@hv/deadlines";

/** Everything a service function needs: the tenant transaction, the caller and "today". */
export interface Ctx {
  trx: Tx;
  principal: Principal;
  today: IsoDate;
  requestId?: string;
}
