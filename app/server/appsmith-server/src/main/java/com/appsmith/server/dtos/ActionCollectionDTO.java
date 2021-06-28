package com.appsmith.server.dtos;

import com.appsmith.external.models.JSValue;
import com.appsmith.server.constants.FieldName;
import com.appsmith.server.domains.PluginType;
import com.appsmith.server.exceptions.AppsmithError;
import com.fasterxml.jackson.annotation.JsonIgnore;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.ToString;
import org.springframework.data.annotation.Transient;

import java.time.Instant;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

@Getter
@Setter
@NoArgsConstructor
@ToString
public class ActionCollectionDTO {

    @Transient
    private String id;

    @Transient
    String applicationId;

    @Transient
    String organizationId;

    String name;

    String pageId;

    // This field will only be populated if this collection is bound to one plugin (eg: JS)
    String pluginId;

    PluginType pluginType;

    Instant deletedAt;

    // TODO can be used as template for new actions in collection,
    //  or as default configuration for all actions in the collection
//    ActionDTO defaultAction;

    // This property is not shared with the client since the reference is only useful to server
    @JsonIgnore
    Set<String> actionIds = Set.of();
    ;

    // This property is not shared with the client since the reference is only useful to server
    @JsonIgnore
    Set<String> archivedActionIds = Set.of();
    ;

    // Instead of storing the entire action object, we only populate this field while interacting with the client side
    @Transient
    List<ActionDTO> actions = List.of();

    // Instead of storing the entire action object, we only populate this field while interacting with the client side
    @Transient
    List<ActionDTO> archivedActions = List.of();

    // JS collection fields
    // This is the raw body that contains the entire JS object definition as the user has written it
    String body;

    // This list is currently used to record constants
    List<JSValue> variables;

    public Set<String> validate() {
        Set<String> validationErrors = new HashSet<>();
        if (this.organizationId == null) {
            validationErrors.add(AppsmithError.INVALID_PARAMETER.getMessage(FieldName.ORGANIZATION_ID));
        }
        if (this.applicationId == null) {
            validationErrors.add(AppsmithError.INVALID_PARAMETER.getMessage(FieldName.APPLICATION_ID));
        }
        if (this.pageId == null) {
            validationErrors.add(AppsmithError.INVALID_PARAMETER.getMessage(FieldName.PAGE_ID));
        }
        if (this.pluginId == null) {
            validationErrors.add(AppsmithError.INVALID_PARAMETER.getMessage(FieldName.PLUGIN_ID));
        }
        return validationErrors;
    }
}
