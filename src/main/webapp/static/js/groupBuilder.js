var GroupBuilder = (function(){
    var displayCache = {};
    var initialGroups = [];
    var externalGroups = {};
    var iteratedGroups = [];
    var _strategy = "byMaximumSize";
    var _parameters = {
        byTotalGroups:5,
        byMaximumSize:4
    };
    var renderMember = function(member){
        return $("<div />",{
            class:"groupBuilderMember",
            text:member
        });
    };
    var renderExternalGroups = function(){
        var container = $(".jAlert .groupSlideDialog");
        var importV = container.find(".importGroups").empty();
        _.each(externalGroups,function(orgUnit){
            _.each(orgUnit,function(groupCat){
                var ou = groupCat.orgUnit;
                if(ou){
                    if(displayCache[ou.name]){
                        displayCache[ou.name].remove();
                    }
                    var ouV = displayCache[ou.name] = $("<div />",{
                        text:ou.name
                    }).appendTo(importV);
                    var groupId = 0;
                    var groupSet = groupCat.groupSet;
                    var groupSetV = $("<div />",{
                    }).appendTo(ouV);
                    groupSetV.append("<div />",{
                        class:"groupCatName",
                        text:groupSet.name
                    });
                    _.each(groupCat.groups,function(group){
                        groupId++;
                        var groupV = $("<div />",{
                            class:"groupBuilderGroup",
                            text:group.name
                        }).appendTo(groupSetV);
                        var inputId = sprintf("structuralGroup_%s",groupId);
                        var inputV = $("<input />",{
                            type:"checkbox",
                            id:inputId
                        }).on("click",function(){
                            if(_.includes(initialGroups,group)){
                                initialGroups = _.without(initialGroups,group);
                            }
                            else{
                                initialGroups.push(group);
                            }
                            doSimulation();
                        }).appendTo(groupV);
                        inputV.prop("checked",_.includes(initialGroups,group));
                        $("<label />",{
                            for:inputId
                        }).append($("<span />",{
                            class:"icon-txt",
                            text:"Copy"
                        })).appendTo(groupV);
                        _.each(group.members,function(member){
                            renderMember(member.name).appendTo(groupV);
                        });
                    });
                }
            });
        });
    }
    var simulate = function(strategy,parameter){
        var groups = _.map(initialGroups,function(g){
            var r = {};
            _.each(g.members,function(m){
                r[m.name] = true;
            });
            return r;
        });
        var attendees = _.without(Participants.getPossibleParticipants(),Conversations.getCurrentConversation().author);
        attendees = _.omitBy(attendees,function(k){
            return _.some(groups,function(g){
                return k in g;
            });
        });
        var filler;
        switch(strategy){
        case "byTotalGroups":
            for(var i = groups.length; i < parseInt(parameter);i++){
                groups.push({});
            }
            filler = function(p){
                var targetG = _.sortBy(groups,function(g){return _.keys(g).length})
                targetG[0][p] = true;
            }
            break;
        case "byMaximumSize":
            filler = function(p){
                var targetG = _.find(groups,function(g){
                    return _.keys(g).length < parseInt(parameter);
                });
                if(!targetG){
                    targetG = {};
                    groups.push(targetG);
                }
                targetG[p] = true;
            }
            break;
        }
        _.each(attendees,filler);
        console.log(groups);
        return _.map(groups,_.keys);
    }
    var renderStrategies = function(container){
        _.each([
            ["there are","byTotalGroups"],
            ["each has","byMaximumSize"]],function(params){
                $("<option />",{
                    text:params[0],
                    value:params[1]
                }).appendTo(container);
            });
    }
    var render = function(){
        var container = $("#groupsPopup");
        var composition = $("#groupComposition");
        var importV = container.find(".importGroups").empty();
        var groupsV = container.find(".groups").empty();
        var slide = Conversations.getCurrentSlide();
        if(slide){
            _.each(slide.groupSets,function(groupSet){
                _.each(_.sortBy(groupSet.groups,"title"),function(group){
                    var g = $("<div />",{
                        class:"groupBuilderGroup"
                    }).appendTo(groupsV).droppable({
                        drop:function(e,ui){
                            var members = $(ui.draggable).find(".groupBuilderMember").addBack(".groupBuilderMember");
                            console.log("Dropped",$(ui.draggable),members);
                            _.each(members,function(memberV){
                                var member = $(memberV).text();
                                console.log("Drop member",member);
                                if(! _.includes(group.members,member)){
                                    _.each(groupSet.groups,function(g){
                                        g.members = _.without(g.members,member);
                                    });
                                    group.members.push(member);
                                    render();
                                    Conversations.overrideAllocation(slide);
                                }
                            });
                            e.preventDefault();
                        }
                    });
                    $("<div />",{
                        class:"title",
                        text:sprintf("Group %s",group.title)
                    }).appendTo(g);
                    _.each(group.members,function(member){
                        renderMember(member).appendTo(g).draggable();
                    });
                });
            });
        }
    };
    var doSimulation = function(simulated){
        var container = $(".jAlert .groupSlideDialog");
        var strategySelect = container.find(".strategySelect");
        var parameterSelect = container.find(".parameterSelect");
        var groupsV = container.find(".groups");
        simulated = simulated || simulate(strategySelect.val(),parameterSelect.val());
        groupsV.empty();
        _.each(simulated,function(group){
            console.log(group);
            var g = $("<div />",{
                class:"groupBuilderGroup ghost"
            });
            _.each(group,function(member){
                renderMember(member).draggable().appendTo(g);
            });
            g.droppable({
                drop:function(e,ui){
                    var member = $(ui.draggable).text();
                    _.each(simulated,function(gr){
                        if(_.includes(gr,member)){
                            gr.splice(gr.indexOf(member),1);
                        }
                    });
                    group.push(member);
                    iteratedGroups = simulated;
                    doSimulation(simulated);
                    e.preventDefault();
                }
            });
            g.appendTo(groupsV);
        });
    };
    var showAddGroupSlideDialogFunc = function(){
        getGroupsProviders();
        var container = $("#groupSlideDialog").clone().show();
        var jAlert = $.jAlert({
            title:"Add Group page",
            width:"75%",
            content:container[0].outerHTML,
            btns:[{
                text:"Add page",
                theme:'green',
                closeAlert:true,
                onClick:function(){
                    var seed = iteratedGroups.length > 0 ? iteratedGroups : _.map(initialGroups,function(group){return _.map(group.members,"name")});
                    Conversations.addGroupSlide(_strategy, parseInt(_parameters[_strategy]), seed);
                    iteratedGroups = [];
                    externalGroups = {};
                }
            }]
        });
        container = $(".jAlert .groupSlideDialog");
        var strategySelect = container.find(".strategySelect");
        var parameterSelect = container.find(".parameterSelect");
        var groupsV = container.find(".groups");
        renderStrategies(strategySelect);
        container.on("change",".strategySelect",function(){
            _strategy = $(this).val();
            console.log("Strategy set:",_strategy);
            parameterSelect.empty();
            switch(_strategy){
            case "byTotalGroups":
                _.each(_.range(2,10),function(i){
                    $("<option />",{
                        text:sprintf("%s groups in total",i),
                        value:i.toString()
                    }).appendTo(parameterSelect);
                });
                parameterSelect.val(_parameters[_strategy]).change();
                break;
            case "byMaximumSize":
                _.each(_.range(1,10),function(i){
                    $("<option />",{
                        text:i == 1 ? "only one member" : sprintf("at most %s members",i),
                        value:i.toString()
                    }).appendTo(parameterSelect);
                });
                parameterSelect.val(_parameters[_strategy]).change();
                break;
            }
        });
        container.on("change",".parameterSelect",function(){
            console.log("change parameter",_parameters);
            _parameters[_strategy] = $(this).val();
            doSimulation();
        });
        strategySelect.val(_strategy).change();
    };
    Progress.groupProvidersReceived["GroupBuilder"] = function(args){
        var select = $(".jAlert .ouSelector").empty();
        $("<option />",{
            text:"no starting groups",
            value:"NONE",
            selected:true
        }).appendTo(select);
        _.each(args.groupsProviders,function(provider){
            $("<option />",{
                text:provider,
                value:provider
            }).appendTo(select);
        });
        select.on("change",function(){
            var choice = $(this).val();
            if(choice != "NONE"){
                getOrgUnitsFromGroupProviders(choice);
            }
        });
    };
    Progress.groupsReceived["GroupBuilder"] = function(args){
        var byOrgUnit = externalGroups[args.orgUnit.name];
        if (byOrgUnit === undefined){
            byOrgUnit = {};
            externalGroups[args.orgUnit.name] = byOrgUnit;
        }
        byOrgUnit[args.groupSet.name] = args;
        renderExternalGroups();
    };
    Progress.onBackstageShow["GroupBuilder"] = function(backstage){
        if(backstage == "groups"){
            render();
        }
    };
    Progress.currentSlideJidReceived["GroupBuilder"] = function(){
        if(currentBackstage == "groups"){
            render();
        }
    };
    Progress.conversationDetailsReceived["GroupBuilder"] = function(){
        if(currentBackstage == "groups"){
            render();
        }
    };
    return {
        showAddGroupSlideDialog:showAddGroupSlideDialogFunc
    };
})();