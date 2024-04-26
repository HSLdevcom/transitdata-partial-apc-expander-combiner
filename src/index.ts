import main from "./main";

main(undefined).catch((err: unknown) => {
  // eslint-disable-next-line no-console
  console.error("Error occurred in main function:", err);
});
