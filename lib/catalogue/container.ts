import { Container } from "@needle-di/core";
import { CacheStore } from "@/lib/cache/cache-store";
import { Clock } from "@/lib/catalogue/clock";
import { CatalogueGateway } from "@/lib/catalogue/gateway";
import { UpstreamClient } from "@/lib/catalogue/upstream";

export function createCatalogueContainer(deps: {
  cache: CacheStore;
  upstream: UpstreamClient;
  clock?: Clock;
}): Container {
  const container = new Container();
  container.bind({ provide: CacheStore, useValue: deps.cache });
  container.bind({ provide: UpstreamClient, useValue: deps.upstream });
  if (deps.clock) {
    container.bind({ provide: Clock, useValue: deps.clock });
  } else {
    container.bind(Clock);
  }
  // Register explicitly. The Next.js server compiler does not preserve the
  // @injectable metadata that Needle uses for auto-binding.
  container.bind(CatalogueGateway);
  return container;
}
