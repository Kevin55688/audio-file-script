import "@testing-library/jest-dom";
import { configure } from "@testing-library/react";

// jsdom environment is slow; increase findBy* timeout
configure({ asyncUtilTimeout: 5000 });
