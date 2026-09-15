import { AsyncLocalStorage } from "node:async_hooks";

interface RequestContext {
  tenantId: number;
  userId: number;
}

const requestContext = new AsyncLocalStorage<RequestContext>();

export function runWithRequestContext<T>(context: RequestContext, callback: () => T): T {
  return requestContext.run(context, callback);
}

export function getRequestTenantId(): number | undefined {
  return requestContext.getStore()?.tenantId;
}
