import { defineConfig } from "vite";
import yaml from "js-yaml";

function yamlContentPlugin() {
  return {
    name: "yaml-content-loader",
    transform(code, id) {
      const filePath = id.split("?", 1)[0];
      if (!filePath.endsWith(".yaml") && !filePath.endsWith(".yml")) {
        return null;
      }

      const value = yaml.load(code) ?? {};
      return {
        code: `export default ${JSON.stringify(value)};`,
        map: null,
      };
    },
  };
}

export default defineConfig({
  plugins: [yamlContentPlugin()],
});
