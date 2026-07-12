export {
  API_GROUP,
  API_VERSION,
  API_GROUP_VERSION,
  ORCHESTRATOR_FUNCTION_NAME,
  PLATFORM_LABELS,
  PROFILES,
  PROFILE_DEFAULTS,
  PRODUCT_CONTRACTS,
  POSTGRES_PROVIDERS,
  POSTGRES_CONNECTION_KEYS,
  OBJECT_STORAGE_PROVIDERS,
  OBJECT_STORAGE_CONNECTION_KEYS,
} from './contract.gen';

/** Labels applied to every composed resource for cost attribution and ownership. */
export const MANDATORY_LABELS = ['team', 'cost-center', 'platform.7kgroup.org/stack'];
