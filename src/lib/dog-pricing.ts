// Dog-walking per-dog pricing rule (pure — safe to import from client code).
// Standard price is the service's per-dog rate; walking 3 or more dogs together
// drops the per-dog rate to a bulk rate.

export const MULTI_DOG_MIN = 2; // "more than 1 dog"
export const MULTI_DOG_PRICE = 1400; // £14.00 per dog when MULTI_DOG_MIN+

// The per-dog price to use for `numDogs` dogs on one walk.
export function perDogPrice(basePerDog: number, numDogs: number): number {
  return Math.max(1, numDogs) >= MULTI_DOG_MIN ? MULTI_DOG_PRICE : basePerDog;
}

// Total for a walk: per-dog price × number of dogs.
export function walkPriceFor(basePerDog: number, numDogs: number): number {
  const n = Math.max(1, numDogs);
  return perDogPrice(basePerDog, n) * n;
}
