import { all, call, put, select, take, takeEvery } from "redux-saga/effects";
import * as Sentry from "@sentry/react";
import {
  ReduxAction,
  ReduxActionErrorTypes,
  ReduxActionTypes,
  ReduxActionWithMeta,
  ReduxFormActionTypes,
} from "constants/ReduxActionConstants";
import { getFormData } from "selectors/formSelectors";
import { DATASOURCE_DB_FORM, QUERY_EDITOR_FORM_NAME } from "constants/forms";
import history from "utils/history";
import {
  APPLICATIONS_URL,
  DATA_SOURCES_EDITOR_ID_URL,
  QUERIES_EDITOR_ID_URL,
  INTEGRATION_EDITOR_URL,
  INTEGRATION_TABS,
} from "constants/routes";
import {
  getCurrentApplicationId,
  getCurrentPageId,
} from "selectors/editorSelectors";
import { autofill, change, initialize } from "redux-form";
import {
  getAction,
  getDatasource,
  getPluginTemplates,
  getPlugin,
} from "selectors/entitiesSelector";
import { PluginType, QueryAction } from "entities/Action";
import { setActionProperty } from "actions/actionActions";
import { getQueryParams } from "utils/AppsmithUtils";
import { isEmpty, merge } from "lodash";
import { getConfigInitialValues } from "components/formControls/utils";
import { Variant } from "components/ads/common";
import { Toaster } from "components/ads/Toast";
import { Datasource } from "entities/Datasource";
import _ from "lodash";
import { createMessage, ERROR_ACTION_RENAME_FAIL } from "constants/messages";
import get from "lodash/get";

function* changeQuerySaga(actionPayload: ReduxAction<{ id: string }>) {
  const { id } = actionPayload.payload;
  const state = yield select();
  const editorConfigs = state.entities.plugins.editorConfigs;
  const settingConfigs = state.entities.plugins.settingConfigs;
  let configInitialValues = {};
  // // Typescript says Element does not have blur function but it does;
  // document.activeElement &&
  //   "blur" in document.activeElement &&
  //   // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  //   // @ts-ignore: No types available
  //   document.activeElement.blur();
  const applicationId = yield select(getCurrentApplicationId);
  const pageId = yield select(getCurrentPageId);
  if (!applicationId || !pageId) {
    history.push(APPLICATIONS_URL);
    return;
  }
  const action = yield select(getAction, id);
  if (!action) {
    history.push(
      INTEGRATION_EDITOR_URL(applicationId, pageId, INTEGRATION_TABS.ACTIVE),
    );
    return;
  }

  const currentEditorConfig = editorConfigs[action.datasource.pluginId];
  const currentSettingConfig = settingConfigs[action.datasource.pluginId];

  // If config exists
  if (currentEditorConfig) {
    // Get initial values
    configInitialValues = yield call(
      getConfigInitialValues,
      currentEditorConfig,
    );
  }

  if (currentSettingConfig) {
    const settingInitialValues = yield call(
      getConfigInitialValues,
      currentSettingConfig,
    );
    configInitialValues = merge(configInitialValues, settingInitialValues);
  }

  // Merge the initial values and action.
  const formInitialValues = merge(configInitialValues, action);

  yield put(initialize(QUERY_EDITOR_FORM_NAME, formInitialValues));
}

function* formValueChangeSaga(
  actionPayload: ReduxActionWithMeta<string, { field: string; form: string }>,
) {
  const { field, form } = actionPayload.meta;
  if (field === "dynamicBindingPathList" || field === "name") return;
  if (form !== QUERY_EDITOR_FORM_NAME) return;
  const { values } = yield select(getFormData, QUERY_EDITOR_FORM_NAME);

  if (field === "datasource.id") {
    const datasource = yield select(getDatasource, actionPayload.payload);

    // Update the datasource not just the datasource id.
    yield put(
      setActionProperty({
        actionId: values.id,
        propertyName: "datasource",
        value: datasource,
      }),
    );

    // Update the datasource of the form as well
    yield put(autofill(QUERY_EDITOR_FORM_NAME, "datasource", datasource));

    return;
  }

  if (
    actionPayload.type === ReduxFormActionTypes.ARRAY_REMOVE ||
    actionPayload.type === ReduxFormActionTypes.ARRAY_PUSH
  ) {
    const value = get(values, field);
    yield put(
      setActionProperty({
        actionId: values.id,
        propertyName: field,
        value,
      }),
    );
  } else {
    yield put(
      setActionProperty({
        actionId: values.id,
        propertyName: field,
        value: actionPayload.payload,
      }),
    );
  }
}

function* handleQueryCreatedSaga(actionPayload: ReduxAction<QueryAction>) {
  const {
    actionConfiguration,
    id,
    pluginId,
    pluginType,
  } = actionPayload.payload;
  if (pluginType === PluginType.DB) {
    yield put(initialize(QUERY_EDITOR_FORM_NAME, actionPayload.payload));
    const applicationId = yield select(getCurrentApplicationId);
    const pageId = yield select(getCurrentPageId);
    const pluginTemplates = yield select(getPluginTemplates);
    const queryTemplate = pluginTemplates[pluginId];
    // Do not show template view if the query has body(code) or if there are no templates
    const showTemplate = !(
      !!actionConfiguration.body || isEmpty(queryTemplate)
    );
    history.replace(
      QUERIES_EDITOR_ID_URL(applicationId, pageId, id, {
        editName: "true",
        showTemplate,
      }),
    );
  }
}

function* handleDatasourceCreatedSaga(actionPayload: ReduxAction<Datasource>) {
  const plugin = yield select(getPlugin, actionPayload.payload.pluginId);
  // Only look at db plugins
  if (plugin.type !== PluginType.DB) return;

  const applicationId = yield select(getCurrentApplicationId);
  const pageId = yield select(getCurrentPageId);

  yield put(
    initialize(DATASOURCE_DB_FORM, _.omit(actionPayload.payload, "name")),
  );
  history.push(
    DATA_SOURCES_EDITOR_ID_URL(applicationId, pageId, actionPayload.payload.id),
  );
}

function* handleNameChangeSaga(
  action: ReduxAction<{ id: string; name: string }>,
) {
  yield put(change(QUERY_EDITOR_FORM_NAME, "name", action.payload.name));
}

function* handleNameChangeSuccessSaga(
  action: ReduxAction<{ actionId: string }>,
) {
  const { actionId } = action.payload;
  const actionObj = yield select(getAction, actionId);
  yield take(ReduxActionTypes.FETCH_ACTIONS_FOR_PAGE_SUCCESS);
  if (!actionObj) {
    // Error case, log to sentry
    Toaster.show({
      text: createMessage(ERROR_ACTION_RENAME_FAIL, ""),
      variant: Variant.danger,
    });

    Sentry.captureException(
      new Error(createMessage(ERROR_ACTION_RENAME_FAIL, "")),
      {
        extra: {
          actionId: actionId,
        },
      },
    );
    return;
  }
  if (actionObj.pluginType === PluginType.DB) {
    const params = getQueryParams();
    if (params.editName) {
      params.editName = "false";
    }
    const applicationId = yield select(getCurrentApplicationId);
    const pageId = yield select(getCurrentPageId);
    history.replace(
      QUERIES_EDITOR_ID_URL(applicationId, pageId, actionId, params),
    );
  }
}

function* handleNameChangeFailureSaga(
  action: ReduxAction<{ oldName: string }>,
) {
  yield put(change(QUERY_EDITOR_FORM_NAME, "name", action.payload.oldName));
}

export default function* root() {
  yield all([
    takeEvery(ReduxActionTypes.CREATE_ACTION_SUCCESS, handleQueryCreatedSaga),
    takeEvery(
      ReduxActionTypes.CREATE_DATASOURCE_SUCCESS,
      handleDatasourceCreatedSaga,
    ),
    takeEvery(ReduxActionTypes.QUERY_PANE_CHANGE, changeQuerySaga),
    takeEvery(ReduxActionTypes.SAVE_ACTION_NAME_INIT, handleNameChangeSaga),
    takeEvery(
      ReduxActionTypes.SAVE_ACTION_NAME_SUCCESS,
      handleNameChangeSuccessSaga,
    ),
    takeEvery(
      ReduxActionErrorTypes.SAVE_ACTION_NAME_ERROR,
      handleNameChangeFailureSaga,
    ),
    // Intercepting the redux-form change actionType
    takeEvery(ReduxFormActionTypes.VALUE_CHANGE, formValueChangeSaga),
    takeEvery(ReduxFormActionTypes.ARRAY_REMOVE, formValueChangeSaga),
  ]);
}
