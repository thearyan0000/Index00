
// Components are separate, but legacy controls deliberately keep their IDs so
// the preserved graphics engine can attach its event handlers without visual regressions.
import stage from '../templates/stage.html?raw';
import header from '../templates/header.html?raw';
import panels from '../templates/panels.html?raw';
import tools from '../templates/tools.html?raw';
import dialogs from '../templates/dialogs.html?raw';
import loader from '../templates/loader.html?raw';

function NativeMarkup({ html }: { html: string }) {
  return <div className="native-fragment" dangerouslySetInnerHTML={{ __html: html }} />;
}
export function EditorStage() { return <NativeMarkup html={stage} />; }
export function EditorHeader() { return <NativeMarkup html={header} />; }
export function EditorPanels() { return <NativeMarkup html={panels} />; }
export function EditorTools() { return <NativeMarkup html={tools} />; }
export function EditorDialogs() { return <NativeMarkup html={dialogs} />; }
export function EditorLoader() { return <NativeMarkup html={loader} />; }
