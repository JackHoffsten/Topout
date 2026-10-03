using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Topout.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddSplitTemplateTargets : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "RightTargetRepsMax",
                table: "WorkoutDaySets",
                type: "integer",
                nullable: true
            );

            migrationBuilder.AddColumn<int>(
                name: "RightTargetRepsMin",
                table: "WorkoutDaySets",
                type: "integer",
                nullable: true
            );

            migrationBuilder.AddColumn<decimal>(
                name: "RightTargetWeight",
                table: "WorkoutDaySets",
                type: "numeric(8,3)",
                precision: 8,
                scale: 3,
                nullable: true
            );
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(
                """
                DO $$ BEGIN
                  IF EXISTS (SELECT 1 FROM "WorkoutDaySets" WHERE "RightTargetRepsMin" IS NOT NULL) THEN
                    RAISE EXCEPTION 'Cannot downgrade while split template targets exist.';
                  END IF;
                END $$;
                """
            );
            migrationBuilder.DropColumn(name: "RightTargetRepsMax", table: "WorkoutDaySets");

            migrationBuilder.DropColumn(name: "RightTargetRepsMin", table: "WorkoutDaySets");

            migrationBuilder.DropColumn(name: "RightTargetWeight", table: "WorkoutDaySets");
        }
    }
}
