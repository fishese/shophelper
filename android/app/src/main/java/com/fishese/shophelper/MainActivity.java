package com.fishese.shophelper;

import android.content.Intent;
import android.os.Bundle;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;
import org.json.JSONObject;

public class MainActivity extends BridgeActivity {
  private static final String EXTRA_PATH = "js.path";

  @Override
  protected void onCreate(Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);
    // Cold start from a launcher shortcut: the bridge has already queued the home URL,
    // so replace it with the requested tool page.
    openLaunchPath(getIntent());
  }

  @Override
  protected void onNewIntent(Intent intent) {
    super.onNewIntent(intent);
    setIntent(intent);
    // Warm start (singleTask): app already running, navigate the existing WebView.
    openLaunchPath(intent);
  }

  private static String readLaunchPath(Intent intent) {
    if (intent == null) return null;
    String path = intent.getStringExtra(EXTRA_PATH);
    if (path == null || !path.startsWith("/tools/") || path.contains("..")) return null;
    return path;
  }

  private void openLaunchPath(Intent intent) {
    final String path = readLaunchPath(intent);
    if (path == null || getBridge() == null) return;
    // Consume so rotation / recreation does not re-navigate.
    intent.removeExtra(EXTRA_PATH);
    final WebView webView = getBridge().getWebView();
    final String url = getBridge().getLocalUrl() + path;
    webView.post(() -> {
      // Backup for js/shell.js boot(); harmless if the current page is not yet an https origin.
      webView.evaluateJavascript(
        "try{localStorage.setItem('shophelper_launch_path'," + JSONObject.quote(path) + ");}catch(e){}",
        null
      );
      webView.loadUrl(url);
    });
  }
}
