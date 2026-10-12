type InvalidateFn = () => void | Promise<void>;

let invalidateRoute: InvalidateFn | null = null;

export function registerRouteInvalidator(fn: InvalidateFn) {
  invalidateRoute = fn;
}

export function invalidateAppRoute() {
  return invalidateRoute?.();
}
