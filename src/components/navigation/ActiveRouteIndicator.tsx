type ActiveRouteIndicatorProps = {
  active: boolean;
};

export function ActiveRouteIndicator({ active }: ActiveRouteIndicatorProps) {
  return active ? <span aria-hidden="true" className="active-route-indicator" /> : null;
}