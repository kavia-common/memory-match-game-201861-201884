import { render, screen } from "@testing-library/react";
import App from "./App";

test("renders Memory Match title", () => {
  render(<App />);
  expect(screen.getByText(/Memory Match/i)).toBeInTheDocument();
});
