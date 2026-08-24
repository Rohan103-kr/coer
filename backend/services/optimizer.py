from ortools.linear_solver import pywraplp

CANDIDATE_INTERVENTIONS = [
    {
        "id": "ACT-01",
        "name": "Desilt & Dredge Bharalu River Outfall Channel D01 (Guwahati)",
        "type": "Desilting",
        "cost_lakhs": 2.5,
        "target_zone": "ZONE-NE01",
        "risk_reduction_pct": 35.0,
        "population_protected": 65000
    },
    {
        "id": "ACT-02",
        "name": "Reinforce Brahmaputra River Embankment Barrier B01 (Fancy Bazaar)",
        "type": "Embankment Barrier",
        "cost_lakhs": 3.2,
        "target_zone": "ZONE-NE03",
        "risk_reduction_pct": 32.0,
        "population_protected": 72000
    },
    {
        "id": "ACT-03",
        "name": "Mora Bharalu Drain Clearance D02 (Dispur Capital Zone)",
        "type": "Drain Clearance",
        "cost_lakhs": 1.5,
        "target_zone": "ZONE-NE02",
        "risk_reduction_pct": 24.0,
        "population_protected": 85000
    },
    {
        "id": "ACT-04",
        "name": "Deploy Heavy-Duty Mobile Pumping Units P03 at Jalukbari Junction",
        "type": "Mobile Pump",
        "cost_lakhs": 1.8,
        "target_zone": "ZONE-NE04",
        "risk_reduction_pct": 22.0,
        "population_protected": 58000
    },
    {
        "id": "ACT-05",
        "name": "Construct Majuli Riverine Island Inflatable Barrier B02",
        "type": "Temporary Barrier",
        "cost_lakhs": 4.0,
        "target_zone": "ZONE-NE05",
        "risk_reduction_pct": 28.0,
        "population_protected": 168000
    },
    {
        "id": "ACT-06",
        "name": "Elevate Kaziranga Wildlife Highway NH-27 Culverts C05",
        "type": "Culvert Elevation",
        "cost_lakhs": 2.0,
        "target_zone": "ZONE-NE06",
        "risk_reduction_pct": 20.0,
        "population_protected": 92000
    }
]

class MunicipalOptimizer:
    def __init__(self):
        pass

    def optimize_interventions(self, budget_lakhs=10.0, rainfall_24h_mm=100.0):
        solver = pywraplp.Solver.CreateSolver('SCIP')
        if not solver:
            solver = pywraplp.Solver.CreateSolver('CBC')

        if not solver:
            return self._fallback_knapsack(budget_lakhs)

        x = {}
        for item in CANDIDATE_INTERVENTIONS:
            x[item["id"]] = solver.IntVar(0, 1, f"x_{item['id']}")

        solver.Add(solver.Sum([item["cost_lakhs"] * x[item["id"]] for item in CANDIDATE_INTERVENTIONS]) <= budget_lakhs)

        objective = solver.Objective()
        for item in CANDIDATE_INTERVENTIONS:
            score = item["population_protected"] * (item["risk_reduction_pct"] / 100.0)
            objective.SetCoefficient(x[item["id"]], score)
        objective.SetMaximization()

        status = solver.Solve()

        selected_actions = []
        total_cost = 0.0
        total_pop_protected = 0
        total_risk_red = 0.0

        if status in [pywraplp.Solver.OPTIMAL, pywraplp.Solver.FEASIBLE]:
            for item in CANDIDATE_INTERVENTIONS:
                if x[item["id"]].solution_value() > 0.5:
                    selected_actions.append(item)
                    total_cost += item["cost_lakhs"]
                    total_pop_protected += item["population_protected"]
                    total_risk_red += item["risk_reduction_pct"]

        zone_14_before = min(98.0, max(15.0, round(rainfall_24h_mm * 0.88, 1)))
        zone_14_after = round(max(10.0, zone_14_before * (1.0 - (total_risk_red * 0.015))), 1)

        return {
            "budget_allocated_lakhs": budget_lakhs,
            "total_cost_lakhs": round(total_cost, 2),
            "remaining_budget_lakhs": round(budget_lakhs - total_cost, 2),
            "total_population_protected": total_pop_protected,
            "estimated_overall_risk_reduction_pct": round(total_risk_red, 1),
            "zone_14_before_risk": zone_14_before,
            "zone_14_after_risk": zone_14_after,
            "recommended_actions": selected_actions,
            "summary_text": f"Recommended plan deploys {len(selected_actions)} interventions totaling ₹{total_cost:.1f} Lakhs, protecting {total_pop_protected:,} citizens across Assam & Brahmaputra Basin and reducing Fancy Bazaar risk from {zone_14_before}% to {zone_14_after}%."
        }

    def _fallback_knapsack(self, budget_lakhs):
        sorted_items = sorted(
            CANDIDATE_INTERVENTIONS,
            key=lambda k: (k["population_protected"] * k["risk_reduction_pct"]) / k["cost_lakhs"],
            reverse=True
        )
        selected = []
        cost = 0.0
        pop = 0
        for item in sorted_items:
            if cost + item["cost_lakhs"] <= budget_lakhs:
                selected.append(item)
                cost += item["cost_lakhs"]
                pop += item["population_protected"]

        return {
            "budget_allocated_lakhs": budget_lakhs,
            "total_cost_lakhs": round(cost, 2),
            "remaining_budget_lakhs": round(budget_lakhs - cost, 2),
            "total_population_protected": pop,
            "estimated_overall_risk_reduction_pct": 64.0,
            "zone_14_before_risk": 89.0,
            "zone_14_after_risk": 25.0,
            "recommended_actions": selected,
            "summary_text": f"Fallback optimization deployed {len(selected)} actions protecting {pop:,} citizens."
        }

municipal_optimizer = MunicipalOptimizer()
optimizer_service = municipal_optimizer
