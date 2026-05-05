const fs = require('fs');
const path = require('path');
const {
  AndroidConfig,
  createRunOncePlugin,
  withAndroidManifest,
  withDangerousMod,
  withMainApplication,
} = require('@expo/config-plugins');

const WIDGETS = [
  {
    kind: 'bar',
    className: 'NovaBarWidgetProvider',
    label: 'NOVA Spending Bar',
    description: 'Spending left, next bill, and record transaction shortcut.',
    providerXml: 'nova_widget_bar',
    layout: 'nova_widget_bar',
    width: 4,
    height: 1,
    minWidth: 250,
    minHeight: 56,
    maxWidth: 520,
    maxHeight: 96,
  },
  {
    kind: 'square',
    className: 'NovaSquareWidgetProvider',
    label: 'NOVA Budget Square',
    description: 'Account budget status with bill and savings progress.',
    providerXml: 'nova_widget_square',
    layout: 'nova_widget_square',
    width: 3,
    height: 3,
    minWidth: 180,
    minHeight: 180,
    maxWidth: 420,
    maxHeight: 420,
  },
  {
    kind: 'bills',
    className: 'NovaBillsWidgetProvider',
    label: 'NOVA Next Bill',
    description: 'Next bill due with spending left and quick logging.',
    providerXml: 'nova_widget_bills',
    layout: 'nova_widget_bills',
    width: 2,
    height: 2,
    minWidth: 120,
    minHeight: 120,
    maxWidth: 320,
    maxHeight: 320,
  },
  {
    kind: 'dashboard',
    className: 'NovaDashboardWidgetProvider',
    label: 'NOVA Budget Dashboard',
    description: 'Spending left, next bill, savings progress, and quick logging.',
    providerXml: 'nova_widget_dashboard',
    layout: 'nova_widget_dashboard',
    width: 4,
    height: 2,
    minWidth: 250,
    minHeight: 120,
    maxWidth: 520,
    maxHeight: 280,
  },
];

function getAndroidPackage(config) {
  const packageName = config.android?.package;
  if (!packageName) {
    throw new Error('NOVA Android widgets require expo.android.package to be set.');
  }
  return packageName;
}

function ensureArray(parent, key) {
  if (!Array.isArray(parent[key])) parent[key] = [];
  return parent[key];
}

function ensureWidgetReceiver(application, packageName, widget) {
  const receivers = ensureArray(application, 'receiver');
  const receiverName = `.${widget.className}`;
  const classPath = `.${widget.className}`;
  const fullClassName = `${packageName}.widgets.${widget.className}`;
  const existing = receivers.find(receiver =>
    receiver?.$?.['android:name'] === classPath ||
    receiver?.$?.['android:name'] === receiverName ||
    receiver?.$?.['android:name'] === fullClassName
  );
  const receiver = existing || { $: {} };
  receiver.$ = {
    ...(receiver.$ || {}),
    'android:name': `${packageName}.widgets.${widget.className}`,
    'android:exported': 'false',
    'android:label': `@string/${widget.providerXml}_label`,
  };
  receiver['intent-filter'] = [{
    action: [{ $: { 'android:name': 'android.appwidget.action.APPWIDGET_UPDATE' } }],
  }];
  receiver['meta-data'] = [{
    $: {
      'android:name': 'android.appwidget.provider',
      'android:resource': `@xml/${widget.providerXml}`,
    },
  }];
  if (!existing) receivers.push(receiver);
}

function ensureDeepLinkIntentFilter(activity) {
  const filters = ensureArray(activity, 'intent-filter');
  for (const host of ['record-transaction', 'quick-log']) {
    const exists = filters.some(filter =>
      filter?.data?.some(data => data?.$?.['android:scheme'] === 'nova' && data?.$?.['android:host'] === host)
    );
    if (exists) continue;
    filters.push({
      action: [{ $: { 'android:name': 'android.intent.action.VIEW' } }],
      category: [
        { $: { 'android:name': 'android.intent.category.DEFAULT' } },
        { $: { 'android:name': 'android.intent.category.BROWSABLE' } },
      ],
      data: [{ $: { 'android:scheme': 'nova', 'android:host': host } }],
    });
  }
}

function ensureQuickLogTileService(application, packageName) {
  const services = ensureArray(application, 'service');
  const fullClassName = `${packageName}.widgets.NovaQuickLogTileService`;
  const existing = services.find(service =>
    service?.$?.['android:name'] === fullClassName ||
    service?.$?.['android:name'] === '.widgets.NovaQuickLogTileService'
  );
  const service = existing || { $: {} };
  service.$ = {
    ...(service.$ || {}),
    'android:name': fullClassName,
    'android:label': '@string/nova_quick_log_tile_label',
    'android:icon': '@mipmap/ic_launcher',
    'android:permission': 'android.permission.BIND_QUICK_SETTINGS_TILE',
    'android:exported': 'true',
  };
  service['intent-filter'] = [{
    action: [{ $: { 'android:name': 'android.service.quicksettings.action.QS_TILE' } }],
  }];
  if (!existing) services.push(service);
}

function injectWidgetPackage(contents, packageName) {
  if (contents.includes('NovaWidgetPackage')) return contents;
  const fqcn = `${packageName}.widgets.NovaWidgetPackage`;
  if (contents.includes('PackageList(this).packages.apply')) {
    return contents.replace(
      /(PackageList\(this\)\.packages\.apply\s*\{)/,
      `$1\n              add(${fqcn}())\n`
    );
  }
  if (contents.includes('return packages;')) {
    return contents.replace(/(\s*)return packages;/, `$1packages.add(new ${fqcn}());\n$1return packages;`);
  }
  if (contents.includes('return packages')) {
    return contents.replace(/(\s*)return packages/, `$1packages.add(${fqcn}())\n$1return packages`);
  }
  throw new Error('Could not find React Native package list in MainApplication.');
}

function writeFileIfChanged(filePath, contents) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  if (fs.existsSync(filePath) && fs.readFileSync(filePath, 'utf8') === contents) return;
  fs.writeFileSync(filePath, contents);
}

function javaPackagePath(packageName) {
  return packageName.split('.').join(path.sep);
}

function generateBaseProvider(packageName) {
  const providerNames = WIDGETS.map(widget => `${widget.className}.class`).join(',\n    ');
  return `package ${packageName}.widgets;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Color;
import android.net.Uri;
import android.widget.RemoteViews;

import org.json.JSONObject;

import ${packageName}.R;

public abstract class NovaBaseWidgetProvider extends AppWidgetProvider {
  static final String PREFS_NAME = "nova_android_widgets";
  static final String SNAPSHOT_KEY = "snapshot";

  private static final Class<?>[] PROVIDERS = new Class<?>[] {
    ${providerNames}
  };

  protected abstract String getKind();
  protected abstract int getLayoutId();

  @Override
  public void onUpdate(Context context, AppWidgetManager appWidgetManager, int[] appWidgetIds) {
    updateWidgets(context, appWidgetManager, getClass(), getKind(), getLayoutId(), appWidgetIds);
  }

  static void updateAll(Context context) {
    AppWidgetManager manager = AppWidgetManager.getInstance(context);
    for (Class<?> provider : PROVIDERS) {
      ComponentName component = new ComponentName(context, provider);
      int[] ids = manager.getAppWidgetIds(component);
      if (ids == null || ids.length == 0) continue;
      String kind = kindForProvider(provider);
      int layoutId = layoutForProvider(provider);
      updateWidgets(context, manager, provider, kind, layoutId, ids);
    }
  }

  private static String kindForProvider(Class<?> provider) {
    if (provider == NovaBarWidgetProvider.class) return "bar";
    if (provider == NovaBillsWidgetProvider.class) return "bills";
    if (provider == NovaDashboardWidgetProvider.class) return "dashboard";
    return "square";
  }

  private static int layoutForProvider(Class<?> provider) {
    if (provider == NovaBarWidgetProvider.class) return R.layout.nova_widget_bar;
    if (provider == NovaBillsWidgetProvider.class) return R.layout.nova_widget_bills;
    if (provider == NovaDashboardWidgetProvider.class) return R.layout.nova_widget_dashboard;
    return R.layout.nova_widget_square;
  }

  private static void updateWidgets(Context context, AppWidgetManager manager, Class<?> provider, String kind, int layoutId, int[] appWidgetIds) {
    JSONObject snapshot = readSnapshot(context);
    for (int id : appWidgetIds) {
      RemoteViews views = new RemoteViews(context.getPackageName(), layoutId);
      bindSnapshot(context, views, snapshot, kind, id);
      manager.updateAppWidget(id, views);
    }
  }

  private static JSONObject readSnapshot(Context context) {
    try {
      SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
      String raw = prefs.getString(SNAPSHOT_KEY, "{}");
      return new JSONObject(raw == null ? "{}" : raw);
    } catch (Exception ignored) {
      return new JSONObject();
    }
  }

  private static String text(JSONObject data, String key, String fallback) {
    String value = data.optString(key, fallback);
    return value == null || value.length() == 0 ? fallback : value;
  }

  private static void setText(RemoteViews views, int id, String value) {
    try {
      views.setTextViewText(id, value);
    } catch (Exception ignored) {}
  }

  private static void setColor(RemoteViews views, int id, int color) {
    try {
      views.setTextColor(id, color);
    } catch (Exception ignored) {}
  }

  private static void setBackgroundColor(RemoteViews views, int id, int color) {
    try {
      views.setInt(id, "setBackgroundColor", color);
    } catch (Exception ignored) {}
  }

  private static void setProgress(RemoteViews views, int id, int progress) {
    try {
      views.setProgressBar(id, 100, Math.max(0, Math.min(100, progress)), false);
    } catch (Exception ignored) {}
  }

  private static PendingIntent recordPendingIntent(Context context, JSONObject data, int appWidgetId) {
    String uri = text(data, "recordUrl", "nova://record-transaction");
    Intent launch = context.getPackageManager().getLaunchIntentForPackage(context.getPackageName());
    Intent intent = launch == null ? new Intent(Intent.ACTION_VIEW) : new Intent(launch);
    intent.setAction(Intent.ACTION_VIEW);
    intent.setData(Uri.parse(uri));
    intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
    int flags = PendingIntent.FLAG_UPDATE_CURRENT;
    if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.M) {
      flags |= PendingIntent.FLAG_IMMUTABLE;
    }
    return PendingIntent.getActivity(context, 4100 + appWidgetId, intent, flags);
  }

  private static void bindSnapshot(Context context, RemoteViews views, JSONObject data, String kind, int appWidgetId) {
    String accountName = text(data, "accountName", "NOVA");
    String spending = text(data, "spendingLeftAmount", "$0");
    String spendingLabel = text(data, "spendingLeftLabel", "Spending left");
    String billName = text(data, "nextBillName", "No bills due");
    String billAmount = text(data, "nextBillAmount", "$0");
    String billDue = text(data, "nextBillDueLabel", "All clear");
    String billMeta = text(data, "nextBillMeta", "No scheduled bill found");
    String goalName = text(data, "savingsGoalName", "Savings goal");
    String goalPercent = text(data, "savingsGoalPercentLabel", "0%");
    String goalAmount = text(data, "savingsGoalAmountLabel", "$0 saved");
    String updated = text(data, "updatedLabel", "Updated now");
    String state = text(data, "spendingLeftState", "neutral");
    int stateColor = "danger".equals(state) ? Color.rgb(255, 111, 97) : "warning".equals(state) ? Color.rgb(255, 193, 87) : Color.rgb(67, 214, 165);

    setText(views, R.id.nova_widget_account, accountName);
    setText(views, R.id.nova_widget_spending_label, spendingLabel);
    setText(views, R.id.nova_widget_spending_amount, spending);
    setText(views, R.id.nova_widget_bill_name, billName);
    setText(views, R.id.nova_widget_bill_amount, billAmount);
    setText(views, R.id.nova_widget_bill_due, billDue);
    setText(views, R.id.nova_widget_bill_meta, billMeta);
    setText(views, R.id.nova_widget_goal_name, goalName);
    setText(views, R.id.nova_widget_goal_percent, goalPercent);
    setText(views, R.id.nova_widget_goal_amount, goalAmount);
    setText(views, R.id.nova_widget_updated, updated);
    setColor(views, R.id.nova_widget_spending_amount, stateColor);
    setBackgroundColor(views, R.id.nova_widget_state_bar, stateColor);
    setProgress(views, R.id.nova_widget_goal_progress, data.optInt("savingsGoalProgressPercent", 0));

    PendingIntent recordIntent = recordPendingIntent(context, data, appWidgetId);
    try {
      views.setOnClickPendingIntent(R.id.nova_widget_record, recordIntent);
      if ("bar".equals(kind)) views.setOnClickPendingIntent(R.id.nova_widget_root, recordIntent);
    } catch (Exception ignored) {}
  }
}
`;
}

function generateWidgetProvider(packageName, widget) {
  return `package ${packageName}.widgets;

import ${packageName}.R;

public class ${widget.className} extends NovaBaseWidgetProvider {
  @Override
  protected String getKind() {
    return "${widget.kind}";
  }

  @Override
  protected int getLayoutId() {
    return R.layout.${widget.layout};
  }
}
`;
}

function generateModule(packageName) {
  return `package ${packageName}.widgets;

import android.content.Context;
import android.content.SharedPreferences;

import androidx.annotation.NonNull;

import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;

public class NovaWidgetModule extends ReactContextBaseJavaModule {
  public NovaWidgetModule(ReactApplicationContext reactContext) {
    super(reactContext);
  }

  @NonNull
  @Override
  public String getName() {
    return "NovaWidgetModule";
  }

  @ReactMethod
  public void updateWidgetData(String snapshotJson, Promise promise) {
    try {
      ReactApplicationContext context = getReactApplicationContext();
      SharedPreferences prefs = context.getSharedPreferences(NovaBaseWidgetProvider.PREFS_NAME, Context.MODE_PRIVATE);
      prefs.edit().putString(NovaBaseWidgetProvider.SNAPSHOT_KEY, snapshotJson == null ? "{}" : snapshotJson).apply();
      NovaBaseWidgetProvider.updateAll(context);
      promise.resolve(true);
    } catch (Exception error) {
      promise.reject("NOVA_WIDGET_UPDATE_FAILED", error);
    }
  }
}
`;
}

function generateQuickLogTileService(packageName) {
  return `package ${packageName}.widgets;

import android.app.PendingIntent;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.service.quicksettings.Tile;
import android.service.quicksettings.TileService;

public class NovaQuickLogTileService extends TileService {
  private static final String QUICK_LOG_URL = "nova://record-transaction?source=quick_settings";

  @Override
  public void onStartListening() {
    super.onStartListening();
    Tile tile = getQsTile();
    if (tile == null) return;
    tile.setLabel("NOVA");
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
      tile.setSubtitle("Log expense");
    }
    tile.setState(Tile.STATE_INACTIVE);
    tile.updateTile();
  }

  @Override
  public void onClick() {
    super.onClick();
    unlockAndRun(new Runnable() {
      @Override
      public void run() {
        openQuickLog();
      }
    });
  }

  private Intent quickLogIntent() {
    Intent launch = getPackageManager().getLaunchIntentForPackage(getPackageName());
    Intent intent = launch == null ? new Intent(Intent.ACTION_VIEW) : new Intent(launch);
    intent.setAction(Intent.ACTION_VIEW);
    intent.setData(Uri.parse(QUICK_LOG_URL));
    intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
    return intent;
  }

  private void openQuickLog() {
    Intent intent = quickLogIntent();
    if (Build.VERSION.SDK_INT >= 34) {
      int flags = PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE;
      PendingIntent pendingIntent = PendingIntent.getActivity(this, 6201, intent, flags);
      startActivityAndCollapse(pendingIntent);
      return;
    }
    startActivityAndCollapse(intent);
  }
}
`;
}

function generatePackage(packageName) {
  return `package ${packageName}.widgets;

import androidx.annotation.NonNull;

import com.facebook.react.ReactPackage;
import com.facebook.react.bridge.NativeModule;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.uimanager.ViewManager;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

public class NovaWidgetPackage implements ReactPackage {
  @NonNull
  @Override
  public List<NativeModule> createNativeModules(@NonNull ReactApplicationContext reactContext) {
    List<NativeModule> modules = new ArrayList<>();
    modules.add(new NovaWidgetModule(reactContext));
    return modules;
  }

  @NonNull
  @Override
  public List<ViewManager> createViewManagers(@NonNull ReactApplicationContext reactContext) {
    return Collections.emptyList();
  }
}
`;
}

function providerXml(widget) {
  return `<?xml version="1.0" encoding="utf-8"?>
<appwidget-provider xmlns:android="http://schemas.android.com/apk/res/android"
  android:description="@string/${widget.providerXml}_description"
  android:initialLayout="@layout/${widget.layout}"
  android:minWidth="${widget.minWidth}dp"
  android:minHeight="${widget.minHeight}dp"
  android:minResizeWidth="${Math.max(56, Math.floor(widget.minWidth * 0.72))}dp"
  android:minResizeHeight="${Math.max(56, Math.floor(widget.minHeight * 0.72))}dp"
  android:maxResizeWidth="${widget.maxWidth}dp"
  android:maxResizeHeight="${widget.maxHeight}dp"
  android:previewLayout="@layout/${widget.layout}"
  android:resizeMode="horizontal|vertical"
  android:targetCellWidth="${widget.width}"
  android:targetCellHeight="${widget.height}"
  android:updatePeriodMillis="1800000"
  android:widgetCategory="home_screen" />
`;
}

const widgetBackground = `<?xml version="1.0" encoding="utf-8"?>
<shape xmlns:android="http://schemas.android.com/apk/res/android">
  <solid android:color="#101418" />
  <stroke android:width="1dp" android:color="#26323A" />
  <corners android:radius="12dp" />
  <padding android:left="12dp" android:top="10dp" android:right="12dp" android:bottom="10dp" />
</shape>
`;

const widgetButton = `<?xml version="1.0" encoding="utf-8"?>
<shape xmlns:android="http://schemas.android.com/apk/res/android">
  <solid android:color="#43D6A5" />
  <corners android:radius="18dp" />
</shape>
`;

const widgetProgress = `<?xml version="1.0" encoding="utf-8"?>
<layer-list xmlns:android="http://schemas.android.com/apk/res/android">
  <item android:id="@android:id/background">
    <shape>
      <solid android:color="#2A3137" />
      <corners android:radius="5dp" />
    </shape>
  </item>
  <item android:id="@android:id/progress">
    <clip>
      <shape>
        <solid android:color="#43D6A5" />
        <corners android:radius="5dp" />
      </shape>
    </clip>
  </item>
</layer-list>
`;

const sharedTextStyles = `
  android:fontFamily="sans"
  android:includeFontPadding="false"`;

const barLayout = `<?xml version="1.0" encoding="utf-8"?>
<LinearLayout xmlns:android="http://schemas.android.com/apk/res/android"
  android:id="@+id/nova_widget_root"
  android:layout_width="match_parent"
  android:layout_height="match_parent"
  android:background="@drawable/nova_widget_bg"
  android:gravity="center_vertical"
  android:orientation="horizontal"
  android:padding="10dp">
  <TextView
    android:id="@+id/nova_widget_state_bar"
    android:layout_width="4dp"
    android:layout_height="match_parent"
    android:layout_marginRight="10dp"
    android:background="#43D6A5" />
  <LinearLayout
    android:layout_width="0dp"
    android:layout_height="wrap_content"
    android:layout_weight="1"
    android:orientation="vertical">
    <TextView
      android:id="@+id/nova_widget_account"
      android:layout_width="match_parent"
      android:layout_height="wrap_content"
      android:ellipsize="end"
      android:maxLines="1"
      android:text="NOVA"
      android:textColor="#AAB4BE"
      android:textSize="11sp"${sharedTextStyles} />
    <TextView
      android:id="@+id/nova_widget_spending_amount"
      android:layout_width="match_parent"
      android:layout_height="wrap_content"
      android:ellipsize="end"
      android:maxLines="1"
      android:text="$0"
      android:textColor="#43D6A5"
      android:textStyle="bold"
      android:textSize="19sp"${sharedTextStyles} />
  </LinearLayout>
  <LinearLayout
    android:layout_width="0dp"
    android:layout_height="wrap_content"
    android:layout_weight="1"
    android:orientation="vertical"
    android:paddingLeft="8dp">
    <TextView
      android:id="@+id/nova_widget_spending_label"
      android:layout_width="match_parent"
      android:layout_height="wrap_content"
      android:ellipsize="end"
      android:maxLines="1"
      android:text="Spending left"
      android:textColor="#E8EEF2"
      android:textSize="11sp"${sharedTextStyles} />
    <TextView
      android:id="@+id/nova_widget_bill_name"
      android:layout_width="match_parent"
      android:layout_height="wrap_content"
      android:ellipsize="end"
      android:maxLines="1"
      android:text="Next bill"
      android:textColor="#AAB4BE"
      android:textSize="10sp"${sharedTextStyles} />
  </LinearLayout>
  <TextView
    android:id="@+id/nova_widget_bill_amount"
    android:layout_width="1dp"
    android:layout_height="1dp"
    android:visibility="gone" />
  <TextView
    android:id="@+id/nova_widget_bill_due"
    android:layout_width="1dp"
    android:layout_height="1dp"
    android:visibility="gone" />
  <TextView
    android:id="@+id/nova_widget_bill_meta"
    android:layout_width="1dp"
    android:layout_height="1dp"
    android:visibility="gone" />
  <TextView
    android:id="@+id/nova_widget_goal_name"
    android:layout_width="1dp"
    android:layout_height="1dp"
    android:visibility="gone" />
  <TextView
    android:id="@+id/nova_widget_goal_percent"
    android:layout_width="1dp"
    android:layout_height="1dp"
    android:visibility="gone" />
  <TextView
    android:id="@+id/nova_widget_goal_amount"
    android:layout_width="1dp"
    android:layout_height="1dp"
    android:visibility="gone" />
  <ProgressBar
    android:id="@+id/nova_widget_goal_progress"
    style="?android:attr/progressBarStyleHorizontal"
    android:layout_width="1dp"
    android:layout_height="1dp"
    android:visibility="gone" />
  <TextView
    android:id="@+id/nova_widget_updated"
    android:layout_width="1dp"
    android:layout_height="1dp"
    android:visibility="gone" />
  <TextView
    android:id="@+id/nova_widget_record"
    android:layout_width="92dp"
    android:layout_height="36dp"
    android:background="@drawable/nova_widget_button"
    android:gravity="center"
    android:text="Record"
    android:textColor="#08110E"
    android:textStyle="bold"
    android:textSize="12sp"${sharedTextStyles} />
</LinearLayout>
`;

const squareLayout = `<?xml version="1.0" encoding="utf-8"?>
<LinearLayout xmlns:android="http://schemas.android.com/apk/res/android"
  android:id="@+id/nova_widget_root"
  android:layout_width="match_parent"
  android:layout_height="match_parent"
  android:background="@drawable/nova_widget_bg"
  android:orientation="vertical"
  android:padding="14dp">
  <TextView
    android:id="@+id/nova_widget_state_bar"
    android:layout_width="42dp"
    android:layout_height="4dp"
    android:background="#43D6A5" />
  <TextView
    android:id="@+id/nova_widget_account"
    android:layout_width="match_parent"
    android:layout_height="wrap_content"
    android:layout_marginTop="8dp"
    android:ellipsize="end"
    android:maxLines="1"
    android:text="NOVA"
    android:textColor="#AAB4BE"
    android:textSize="12sp"${sharedTextStyles} />
  <TextView
    android:id="@+id/nova_widget_spending_label"
    android:layout_width="match_parent"
    android:layout_height="wrap_content"
    android:layout_marginTop="8dp"
    android:text="Spending left"
    android:textColor="#E8EEF2"
    android:textSize="12sp"${sharedTextStyles} />
  <TextView
    android:id="@+id/nova_widget_spending_amount"
    android:layout_width="match_parent"
    android:layout_height="wrap_content"
    android:ellipsize="end"
    android:maxLines="1"
    android:text="$0"
    android:textColor="#43D6A5"
    android:textSize="26sp"
    android:textStyle="bold"${sharedTextStyles} />
  <TextView
    android:id="@+id/nova_widget_bill_name"
    android:layout_width="match_parent"
    android:layout_height="wrap_content"
    android:layout_marginTop="8dp"
    android:ellipsize="end"
    android:maxLines="1"
    android:text="Next bill"
    android:textColor="#E8EEF2"
    android:textSize="13sp"
    android:textStyle="bold"${sharedTextStyles} />
  <TextView
    android:id="@+id/nova_widget_bill_due"
    android:layout_width="match_parent"
    android:layout_height="wrap_content"
    android:ellipsize="end"
    android:maxLines="1"
    android:text="Due soon"
    android:textColor="#AAB4BE"
    android:textSize="11sp"${sharedTextStyles} />
  <TextView
    android:id="@+id/nova_widget_bill_amount"
    android:layout_width="match_parent"
    android:layout_height="wrap_content"
    android:text="$0"
    android:textColor="#FFCF7A"
    android:textSize="12sp"${sharedTextStyles} />
  <TextView
    android:id="@+id/nova_widget_bill_meta"
    android:layout_width="1dp"
    android:layout_height="1dp"
    android:visibility="gone" />
  <TextView
    android:id="@+id/nova_widget_goal_name"
    android:layout_width="match_parent"
    android:layout_height="wrap_content"
    android:layout_marginTop="8dp"
    android:ellipsize="end"
    android:maxLines="1"
    android:text="Savings"
    android:textColor="#AAB4BE"
    android:textSize="11sp"${sharedTextStyles} />
  <ProgressBar
    android:id="@+id/nova_widget_goal_progress"
    style="?android:attr/progressBarStyleHorizontal"
    android:layout_width="match_parent"
    android:layout_height="8dp"
    android:layout_marginTop="4dp"
    android:progressDrawable="@drawable/nova_widget_progress" />
  <TextView
    android:id="@+id/nova_widget_goal_percent"
    android:layout_width="match_parent"
    android:layout_height="wrap_content"
    android:text="0%"
    android:textColor="#43D6A5"
    android:textSize="11sp"${sharedTextStyles} />
  <TextView
    android:id="@+id/nova_widget_goal_amount"
    android:layout_width="1dp"
    android:layout_height="1dp"
    android:visibility="gone" />
  <TextView
    android:id="@+id/nova_widget_updated"
    android:layout_width="1dp"
    android:layout_height="1dp"
    android:visibility="gone" />
  <TextView
    android:id="@+id/nova_widget_record"
    android:layout_width="match_parent"
    android:layout_height="34dp"
    android:layout_marginTop="10dp"
    android:background="@drawable/nova_widget_button"
    android:gravity="center"
    android:text="Record Transaction"
    android:textColor="#08110E"
    android:textStyle="bold"
    android:textSize="12sp"${sharedTextStyles} />
</LinearLayout>
`;

const billsLayout = `<?xml version="1.0" encoding="utf-8"?>
<LinearLayout xmlns:android="http://schemas.android.com/apk/res/android"
  android:id="@+id/nova_widget_root"
  android:layout_width="match_parent"
  android:layout_height="match_parent"
  android:background="@drawable/nova_widget_bg"
  android:orientation="vertical"
  android:padding="12dp">
  <TextView
    android:id="@+id/nova_widget_state_bar"
    android:layout_width="36dp"
    android:layout_height="4dp"
    android:background="#43D6A5" />
  <TextView
    android:id="@+id/nova_widget_account"
    android:layout_width="match_parent"
    android:layout_height="wrap_content"
    android:layout_marginTop="8dp"
    android:ellipsize="end"
    android:maxLines="1"
    android:text="NOVA"
    android:textColor="#AAB4BE"
    android:textSize="11sp"${sharedTextStyles} />
  <TextView
    android:id="@+id/nova_widget_bill_name"
    android:layout_width="match_parent"
    android:layout_height="wrap_content"
    android:layout_marginTop="8dp"
    android:ellipsize="end"
    android:maxLines="2"
    android:text="Next bill"
    android:textColor="#E8EEF2"
    android:textSize="17sp"
    android:textStyle="bold"${sharedTextStyles} />
  <TextView
    android:id="@+id/nova_widget_bill_amount"
    android:layout_width="match_parent"
    android:layout_height="wrap_content"
    android:text="$0"
    android:textColor="#FFCF7A"
    android:textSize="21sp"
    android:textStyle="bold"${sharedTextStyles} />
  <TextView
    android:id="@+id/nova_widget_bill_due"
    android:layout_width="match_parent"
    android:layout_height="wrap_content"
    android:ellipsize="end"
    android:maxLines="1"
    android:text="Due soon"
    android:textColor="#AAB4BE"
    android:textSize="12sp"${sharedTextStyles} />
  <TextView
    android:id="@+id/nova_widget_bill_meta"
    android:layout_width="match_parent"
    android:layout_height="0dp"
    android:layout_weight="1"
    android:ellipsize="end"
    android:maxLines="2"
    android:text="Account status"
    android:textColor="#AAB4BE"
    android:textSize="11sp"${sharedTextStyles} />
  <TextView
    android:id="@+id/nova_widget_spending_label"
    android:layout_width="1dp"
    android:layout_height="1dp"
    android:visibility="gone" />
  <TextView
    android:id="@+id/nova_widget_spending_amount"
    android:layout_width="1dp"
    android:layout_height="1dp"
    android:visibility="gone" />
  <TextView
    android:id="@+id/nova_widget_goal_name"
    android:layout_width="1dp"
    android:layout_height="1dp"
    android:visibility="gone" />
  <TextView
    android:id="@+id/nova_widget_goal_percent"
    android:layout_width="1dp"
    android:layout_height="1dp"
    android:visibility="gone" />
  <TextView
    android:id="@+id/nova_widget_goal_amount"
    android:layout_width="1dp"
    android:layout_height="1dp"
    android:visibility="gone" />
  <ProgressBar
    android:id="@+id/nova_widget_goal_progress"
    style="?android:attr/progressBarStyleHorizontal"
    android:layout_width="1dp"
    android:layout_height="1dp"
    android:visibility="gone" />
  <TextView
    android:id="@+id/nova_widget_updated"
    android:layout_width="1dp"
    android:layout_height="1dp"
    android:visibility="gone" />
  <TextView
    android:id="@+id/nova_widget_record"
    android:layout_width="match_parent"
    android:layout_height="34dp"
    android:background="@drawable/nova_widget_button"
    android:gravity="center"
    android:text="Record Transaction"
    android:textColor="#08110E"
    android:textStyle="bold"
    android:textSize="12sp"${sharedTextStyles} />
</LinearLayout>
`;

const dashboardLayout = `<?xml version="1.0" encoding="utf-8"?>
<LinearLayout xmlns:android="http://schemas.android.com/apk/res/android"
  android:id="@+id/nova_widget_root"
  android:layout_width="match_parent"
  android:layout_height="match_parent"
  android:background="@drawable/nova_widget_bg"
  android:gravity="center_vertical"
  android:orientation="horizontal"
  android:padding="12dp">
  <TextView
    android:id="@+id/nova_widget_state_bar"
    android:layout_width="4dp"
    android:layout_height="match_parent"
    android:layout_marginRight="12dp"
    android:background="#43D6A5" />
  <LinearLayout
    android:layout_width="0dp"
    android:layout_height="match_parent"
    android:layout_weight="1"
    android:orientation="vertical">
    <TextView
      android:id="@+id/nova_widget_account"
      android:layout_width="match_parent"
      android:layout_height="wrap_content"
      android:ellipsize="end"
      android:maxLines="1"
      android:text="NOVA"
      android:textColor="#AAB4BE"
      android:textSize="12sp"${sharedTextStyles} />
    <TextView
      android:id="@+id/nova_widget_spending_label"
      android:layout_width="match_parent"
      android:layout_height="wrap_content"
      android:layout_marginTop="4dp"
      android:text="Spending left"
      android:textColor="#E8EEF2"
      android:textSize="12sp"${sharedTextStyles} />
    <TextView
      android:id="@+id/nova_widget_spending_amount"
      android:layout_width="match_parent"
      android:layout_height="wrap_content"
      android:ellipsize="end"
      android:maxLines="1"
      android:text="$0"
      android:textColor="#43D6A5"
      android:textSize="27sp"
      android:textStyle="bold"${sharedTextStyles} />
    <TextView
      android:id="@+id/nova_widget_updated"
      android:layout_width="match_parent"
      android:layout_height="wrap_content"
      android:text="Updated now"
      android:textColor="#65717A"
      android:textSize="10sp"${sharedTextStyles} />
  </LinearLayout>
  <LinearLayout
    android:layout_width="0dp"
    android:layout_height="match_parent"
    android:layout_weight="1"
    android:orientation="vertical"
    android:paddingLeft="10dp">
    <TextView
      android:id="@+id/nova_widget_bill_name"
      android:layout_width="match_parent"
      android:layout_height="wrap_content"
      android:ellipsize="end"
      android:maxLines="1"
      android:text="Next bill"
      android:textColor="#E8EEF2"
      android:textSize="14sp"
      android:textStyle="bold"${sharedTextStyles} />
    <TextView
      android:id="@+id/nova_widget_bill_due"
      android:layout_width="match_parent"
      android:layout_height="wrap_content"
      android:ellipsize="end"
      android:maxLines="1"
      android:text="Due soon"
      android:textColor="#AAB4BE"
      android:textSize="11sp"${sharedTextStyles} />
    <TextView
      android:id="@+id/nova_widget_bill_amount"
      android:layout_width="match_parent"
      android:layout_height="wrap_content"
      android:text="$0"
      android:textColor="#FFCF7A"
      android:textSize="16sp"
      android:textStyle="bold"${sharedTextStyles} />
    <TextView
      android:id="@+id/nova_widget_bill_meta"
      android:layout_width="1dp"
      android:layout_height="1dp"
      android:visibility="gone" />
    <TextView
      android:id="@+id/nova_widget_goal_name"
      android:layout_width="match_parent"
      android:layout_height="wrap_content"
      android:layout_marginTop="8dp"
      android:ellipsize="end"
      android:maxLines="1"
      android:text="Savings"
      android:textColor="#AAB4BE"
      android:textSize="11sp"${sharedTextStyles} />
    <ProgressBar
      android:id="@+id/nova_widget_goal_progress"
      style="?android:attr/progressBarStyleHorizontal"
      android:layout_width="match_parent"
      android:layout_height="8dp"
      android:layout_marginTop="3dp"
      android:progressDrawable="@drawable/nova_widget_progress" />
    <LinearLayout
      android:layout_width="match_parent"
      android:layout_height="wrap_content"
      android:orientation="horizontal">
      <TextView
        android:id="@+id/nova_widget_goal_percent"
        android:layout_width="0dp"
        android:layout_height="wrap_content"
        android:layout_weight="1"
        android:text="0%"
        android:textColor="#43D6A5"
        android:textSize="10sp"${sharedTextStyles} />
      <TextView
        android:id="@+id/nova_widget_goal_amount"
        android:layout_width="0dp"
        android:layout_height="wrap_content"
        android:layout_weight="1"
        android:gravity="right"
        android:ellipsize="end"
        android:maxLines="1"
        android:text="$0 saved"
        android:textColor="#AAB4BE"
        android:textSize="10sp"${sharedTextStyles} />
    </LinearLayout>
    <TextView
      android:id="@+id/nova_widget_record"
      android:layout_width="match_parent"
      android:layout_height="34dp"
      android:layout_marginTop="8dp"
      android:background="@drawable/nova_widget_button"
      android:gravity="center"
      android:text="Record Transaction"
      android:textColor="#08110E"
      android:textStyle="bold"
      android:textSize="12sp"${sharedTextStyles} />
  </LinearLayout>
</LinearLayout>
`;

const layouts = {
  nova_widget_bar: barLayout,
  nova_widget_square: squareLayout,
  nova_widget_bills: billsLayout,
  nova_widget_dashboard: dashboardLayout,
};

function stringsXml() {
  const strings = WIDGETS.map(widget => `  <string name="${widget.providerXml}_label">${widget.label}</string>
  <string name="${widget.providerXml}_description">${widget.description}</string>`).join('\n');
  return `<?xml version="1.0" encoding="utf-8"?>
<resources>
${strings}
  <string name="nova_quick_log_tile_label">NOVA Quick Log</string>
</resources>
`;
}

function writeAndroidFiles(projectRoot, packageName) {
  const srcDir = path.join(projectRoot, 'android', 'app', 'src', 'main');
  const javaDir = path.join(srcDir, 'java', ...javaPackagePath(packageName).split(path.sep), 'widgets');
  writeFileIfChanged(path.join(javaDir, 'NovaBaseWidgetProvider.java'), generateBaseProvider(packageName));
  writeFileIfChanged(path.join(javaDir, 'NovaWidgetModule.java'), generateModule(packageName));
  writeFileIfChanged(path.join(javaDir, 'NovaWidgetPackage.java'), generatePackage(packageName));
  writeFileIfChanged(path.join(javaDir, 'NovaQuickLogTileService.java'), generateQuickLogTileService(packageName));
  for (const widget of WIDGETS) {
    writeFileIfChanged(path.join(javaDir, `${widget.className}.java`), generateWidgetProvider(packageName, widget));
    writeFileIfChanged(path.join(srcDir, 'res', 'xml', `${widget.providerXml}.xml`), providerXml(widget));
    writeFileIfChanged(path.join(srcDir, 'res', 'layout', `${widget.layout}.xml`), layouts[widget.layout]);
  }
  writeFileIfChanged(path.join(srcDir, 'res', 'drawable', 'nova_widget_bg.xml'), widgetBackground);
  writeFileIfChanged(path.join(srcDir, 'res', 'drawable', 'nova_widget_button.xml'), widgetButton);
  writeFileIfChanged(path.join(srcDir, 'res', 'drawable', 'nova_widget_progress.xml'), widgetProgress);
  writeFileIfChanged(path.join(srcDir, 'res', 'values', 'nova_widget_strings.xml'), stringsXml());
}

const withNovaAndroidWidgets = (config) => {
  const packageName = getAndroidPackage(config);

  config = withAndroidManifest(config, config => {
    const manifest = config.modResults;
    const application = AndroidConfig.Manifest.getMainApplicationOrThrow(manifest);
    for (const widget of WIDGETS) ensureWidgetReceiver(application, packageName, widget);
    ensureQuickLogTileService(application, packageName);
    const mainActivity = AndroidConfig.Manifest.getMainActivityOrThrow(manifest);
    ensureDeepLinkIntentFilter(mainActivity);
    return config;
  });

  config = withMainApplication(config, config => {
    config.modResults.contents = injectWidgetPackage(config.modResults.contents, packageName);
    return config;
  });

  config = withDangerousMod(config, ['android', async config => {
    writeAndroidFiles(config.modRequest.projectRoot, packageName);
    return config;
  }]);

  return config;
};

module.exports = createRunOncePlugin(withNovaAndroidWidgets, 'nova-android-widgets', '1.1.0');
