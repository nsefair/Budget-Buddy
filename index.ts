// Must run before expo-router loads so we can filter dependency-level console
// noise (e.g. expo-router's own deprecated SafeAreaView usage in its dev views).
import "./src/utils/suppressConsole";
import "expo-router/entry";
