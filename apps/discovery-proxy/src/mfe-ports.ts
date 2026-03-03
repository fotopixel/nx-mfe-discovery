// Keys must match the MFE names as they appear in the Discovery Service manifest.
// The format is "{projectName}/{mfeName}".
// Update these to match your Discovery Service project and MFE configuration.
export const MFE_PORTS: Record<string, number> = {
  'my-project/shop': 4201,
  'my-project/cart': 4202,
  'my-project/about': 4203,
};
