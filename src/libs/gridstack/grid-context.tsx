import {
  GridItemHTMLElement,
  GridStack as GridStackC,
  GridStackPosition,
} from "gridstack";
import { createContext, useContext } from "solid-js";

export const GridStackContext = createContext<{
  grid: GridStackC;
  defaultLayout: Record<
    GridItemHTMLElement["id"],
    GridStackPosition
  >;
}>();

export function useGridStackContext() {
  const context = useContext(GridStackContext);
  if (!context) {
    throw new Error(
      "useGridStackContext must be used within a GridStackProvider",
    );
  }
  return context;
}
