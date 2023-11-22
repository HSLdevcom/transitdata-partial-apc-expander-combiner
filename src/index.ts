import main from "./main";

main(undefined).catch((err) => {
  // eslint-disable-next-line no-console
  console.error("Error occurred in main function:", err);
});
